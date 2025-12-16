import * as path from 'path';
import * as fs from 'fs';

export interface ProjectInfo {
 id: string;
 root: string;
 confPath: string;
}

export function discoverProjects(workspaceRoot: string): ProjectInfo[] {
 const base = path.join(workspaceRoot, 'source', 'ru', 'ru');
 if (!fs.existsSync(base)) return [];

 const projects: ProjectInfo[] = [];

 for (const projectName of fs.readdirSync(base)) {
  const projectDir = path.join(base, projectName);
  if (!fs.statSync(projectDir).isDirectory()) continue;

  for (const sub of ['ug', 'ag']) {
   const conf = path.join(projectDir, sub, 'conf.py');
   if (fs.existsSync(conf)) {
    projects.push({
     id: `${projectName}__${sub}`,
     root: path.join(projectDir, sub),
     confPath: conf
    });
   }
  }
 }

 return projects;
}
