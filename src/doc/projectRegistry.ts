import * as path from 'path';
import * as fs from 'fs';
import { getProjectsRootSegmentsList } from '../utils/settings';

export interface ProjectInfo {
 id: string;
 root: string;
 /** Путь к conf.py раздела; null, если раздел опознан по наличию .rst. */
 confPath: string | null;
}

interface SectionInfo {
 isSection: boolean;
 confPath: string | null;
}

/**
 * Каталог считается разделом документации, если в нем лежит conf.py
 * либо хотя бы один .rst.
 *
 * Каталоги только с .rsti (например `_warehouse`) — это хранилища
 * переиспользуемых фрагментов, ссылаться на них нельзя. Пустые каталоги
 * разделами тоже не считаются.
 */
function readSection(dir: string): SectionInfo {
 let entries: fs.Dirent[];

 try {
  entries = fs.readdirSync(dir, { withFileTypes: true });
 } catch {
  return { isSection: false, confPath: null };
 }

 let hasRst = false;

 for (const entry of entries) {
  if (!entry.isFile()) continue;

  if (entry.name === 'conf.py') {
   return { isSection: true, confPath: path.join(dir, 'conf.py') };
  }

  if (entry.name.endsWith('.rst')) {
   hasRst = true;
  }
 }

 return { isSection: hasRst, confPath: null };
}

function readDirNames(dir: string): string[] {
 try {
  return fs.readdirSync(dir, { withFileTypes: true })
   .filter(e => e.isDirectory())
   .map(e => e.name);
 } catch {
  return [];
 }
}

/**
 * Обнаруживает разделы документации по шаблону
 * `<projectsRoots>/<проект>/<раздел>`.
 *
 * Раздел — любая подпапка проекта, прошедшая проверку readSection;
 * раньше список был жестко ограничен `ug` и `ag`.
 */
export function discoverProjects(workspaceRoot: string): ProjectInfo[] {
 const projects: ProjectInfo[] = [];
 const seenIds = new Set<string>();

 for (const segments of getProjectsRootSegmentsList()) {
  const base = path.join(workspaceRoot, ...segments);

  for (const projectName of readDirNames(base)) {
   const projectDir = path.join(base, projectName);

   for (const sectionName of readDirNames(projectDir)) {
    const sectionDir = path.join(projectDir, sectionName);
    const { isSection, confPath } = readSection(sectionDir);
    if (!isSection) continue;

    const id = `${projectName}__${sectionName}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    projects.push({ id, root: sectionDir, confPath });
   }
  }
 }

 return projects;
}
