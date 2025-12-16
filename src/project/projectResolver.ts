import * as fs from 'fs';
import * as path from 'path';

export function findConfPy(startFile: string): string | null {
 let dir = path.dirname(startFile);
 const root = path.parse(dir).root;

 while (dir !== root) {
  const candidate = path.join(dir, 'conf.py');
  if (fs.existsSync(candidate)) {
   return candidate;
  }
  dir = path.dirname(dir);
 }

 return null;
}
