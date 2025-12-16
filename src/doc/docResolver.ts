import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { ProjectInfo } from './projectRegistry';
import { DocTarget } from './docTypes';

/**
 * Извлекает список разрешённых project-id из conf.py
 *
 * Пример:
 * generate_intersphinx_mapping(..., ['project-2__ug', 'project-3__ag'])
 */
export function parseIntersphinxMapping(confPath: string): Set<string> {
 const text = readConfText(confPath);

 const regex =
  /generate_intersphinx_mapping\s*\([^,]+,\s*\[([^\]]*)\]/m;

 const match = regex.exec(text);
 if (!match) {
  return new Set();
 }

 return new Set(
  match[1]
   .split(',')
   .map(s => s.replace(/['"]/g, '').trim())
   .filter(Boolean)
 );
}

/**
 * Разрешает doc-ссылку в конкретный файл
 */
export function resolveDocTarget(
 currentFile: string,
 currentProject: ProjectInfo,
 allProjects: ProjectInfo[],
 allowedProjects: Set<string>,
 target: string
): DocTarget {

 // ─────────────────────────────────────────────
 // 1. Межпроектная ссылка: project-id:path
 // ─────────────────────────────────────────────
 if (target.includes(':')) {
  const [projectId, relPath] = target.split(':', 2);

  // Проверяем, разрешён ли project-id через intersphinx
  if (!allowedProjects.has(projectId)) {
   return {
    filePath: '',
    exists: false
   };
  }

  const project = allProjects.find(p => p.id === projectId);
  if (!project) {
   return {
    filePath: '',
    exists: false
   };
  }

  const fullPath = path.join(project.root, relPath);
  return {
   filePath: fullPath,
   exists: fs.existsSync(fullPath)
  };
 }

 // ─────────────────────────────────────────────
 // 2. Локальная ссылка (относительно текущего файла)
 // ─────────────────────────────────────────────
 const fullPath = path.resolve(
  path.dirname(currentFile),
  target
 );

 return {
  filePath: fullPath,
  exists: fs.existsSync(fullPath)
 };
}

/**
 * Читает conf.py:
 *  - из открытого документа (если открыт в VS Code)
 *  - либо с диска
 */
function readConfText(confPath: string): string {
 const openDoc = vscode.workspace.textDocuments.find(
  d => d.fileName === confPath
 );

 if (openDoc) {
  return openDoc.getText();
 }

 return fs.readFileSync(confPath, 'utf-8');
}
