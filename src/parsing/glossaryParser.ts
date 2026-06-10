import * as fs from 'fs';
import * as path from 'path';

export interface GlossaryTerm {
 term: string;
 definition: string;
 source: string;
}

function parseGlossaryFile(filePath: string): GlossaryTerm[] {
 if (!fs.existsSync(filePath)) return [];

 const text = fs.readFileSync(filePath, 'utf-8');
 const lines = text.split('\n').map(l => l.replace(/\r$/, ''));
 const terms: GlossaryTerm[] = [];

 let inGlossary = false;
 let currentTerm: string | null = null;
 let defLines: string[] = [];

 function flushTerm() {
  if (currentTerm) {
   terms.push({
    term: currentTerm,
    definition: defLines.join('\n').trim(),
    source: filePath,
   });
  }
  currentTerm = null;
  defLines = [];
 }

 for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (/^\.\. glossary::/.test(line)) {
   inGlossary = true;
   continue;
  }

  if (!inGlossary) continue;

  if (line.trim() === '' && currentTerm) {
   // empty line inside glossary block — part of definition or separator
   defLines.push('');
   continue;
  }

  // New section or directive resets glossary block
  if (/^[^\s]/.test(line) && !/^\.\. glossary::/.test(line)) {
   inGlossary = false;
   flushTerm();
   continue;
  }

  // Term line: exactly 3-space indent
  const termMatch = line.match(/^   (\S.*)$/);
  if (termMatch && !/^ {4}/.test(line)) {
   flushTerm();
   currentTerm = termMatch[1].trim();
   continue;
  }

  // Definition line: 6+ spaces indent
  if (/^ {6}/.test(line) && currentTerm) {
   defLines.push(line.trim());
   continue;
  }

  // A new .. glossary:: resets
  if (/^\.\. glossary::/.test(line)) {
   flushTerm();
   inGlossary = true;
  }
 }

 flushTerm();
 return terms;
}

export function parseGlossaryDir(dirPath: string): GlossaryTerm[] {
 if (!fs.existsSync(dirPath)) return [];

 const terms: GlossaryTerm[] = [];
 for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
  if (entry.isFile() && (entry.name.endsWith('.rst') || entry.name.endsWith('.rsti'))) {
   terms.push(...parseGlossaryFile(path.join(dirPath, entry.name)));
  }
 }
 return terms;
}

export function findGlossaryDir(workspaceRoot: string): string | null {
 const candidate = path.join(workspaceRoot, 'source', 'ru', 'ru', 'glossary', 'list');
 return fs.existsSync(candidate) ? candidate : null;
}
