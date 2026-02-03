import * as path from 'path';

export function resolveRstPath(
 raw: string,
 ownerFilePath: string,
 confPath: string
): string {
 const v = (raw ?? '').trim();
 if (!v) return v;

 // relative: "./" or "../"
 if (v.startsWith('./') || v.startsWith('../') || v === '.' || v === '..') {
  return path.normalize(path.resolve(path.dirname(ownerFilePath), v));
 }

 // project-root style: "/..."
 if (v.startsWith('/')) {
  const cleaned = v.replace(/^[/\\]+/, '');
  return path.normalize(path.resolve(path.dirname(confPath), cleaned));
 }

 // fallback: treat as relative to owner file
 return path.normalize(path.resolve(path.dirname(ownerFilePath), v));
}
