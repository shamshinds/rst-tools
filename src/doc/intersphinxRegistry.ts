import * as path from 'path';
import * as fs from 'fs';
import { parseIntersphinxMapping } from './docResolver';

export interface ExternalProject {
 id: string;          // project-2__ug
 root: string;        // .../source/ru/ru/project-2/ug
}

export function getExternalProjects(confPyPath: string): ExternalProject[] {
 const mapping = parseIntersphinxMapping(confPyPath);

 const result: ExternalProject[] = [];

 for (const [id, projectRoot] of Object.entries(mapping)) {
  if (fs.existsSync(projectRoot)) {
   result.push({
    id,
    root: projectRoot
   });
  }
 }

 return result;
}
