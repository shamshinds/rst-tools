import * as path from 'path';
import * as fs from 'fs';
import { getProjectsRootSegmentsList } from '../utils/settings';

export interface ProjectInfo {
 id: string;
 root: string;
 confPath: string;
}

export function discoverProjects(workspaceRoot: string): ProjectInfo[] {
 const projects: ProjectInfo[] = [];
 const seenIds = new Set<string>();

 for (const segments of getProjectsRootSegmentsList()) {
  const base = path.join(workspaceRoot, ...segments);
  if (!fs.existsSync(base)) continue;

  for (const projectName of fs.readdirSync(base)) {
   const projectDir = path.join(base, projectName);
   if (!fs.statSync(projectDir).isDirectory()) continue;

   for (const sub of ['ug', 'ag']) {
    const conf = path.join(projectDir, sub, 'conf.py');
    if (!fs.existsSync(conf)) continue;

    const id = `${projectName}__${sub}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    projects.push({
     id,
     root: path.join(projectDir, sub),
     confPath: conf
    });
   }
  }
 }

 return projects;
}
