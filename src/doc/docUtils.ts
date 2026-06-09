import * as fs from 'fs';

export const DOC_LINK_RE = /:doc:`([^`]+)`/g;

export function normalizeDocTarget(raw: string): string {
 let p = raw.trim();

 const lt = p.lastIndexOf('<');
 const gt = p.lastIndexOf('>');
 if (lt !== -1 && gt !== -1 && gt > lt) {
  p = p.slice(lt + 1, gt).trim();
 }

 const hash = p.indexOf('#');
 if (hash !== -1) {
  p = p.slice(0, hash);
 }

 if (p && !p.endsWith('.rst')) {
  p += '.rst';
 }

 return p;
}

export function splitDocRole(raw: string): { label: string; target: string } {
 const lt = raw.lastIndexOf('<');
 const gt = raw.lastIndexOf('>');

 if (lt !== -1 && gt !== -1 && gt > lt) {
  return {
   label: raw.slice(0, lt).trim(),
   target: raw.slice(lt + 1, gt).trim()
  };
 }

 return { label: raw.trim(), target: raw.trim() };
}

export function extractDocTarget(raw: string): string {
 return splitDocRole(raw).target;
}

export function readRstTitle(filePath: string): string | null {
 try {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length - 1; i++) {
   const title = lines[i].trim();
   const underline = lines[i + 1].trim();

   if (!title || !underline) continue;
   if (underline.length < title.length) continue;

   const ch = underline[0];
   if (!'=-~^"\'`:+#*'.includes(ch)) continue;

   if ([...underline].every(c => c === ch)) {
    return title;
   }
  }

  return null;
 } catch {
  return null;
 }
}
