import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const INCLUDE_REGEX = /^\s*\.\.\s+include::\s+(.+)$/gm;

export async function parseIncludes(confPath: string): Promise<string[]> {
 let text: string;

 const openDoc = vscode.workspace.textDocuments.find(
  (d: vscode.TextDocument) => d.fileName === confPath
 );

 if (openDoc) {
  text = openDoc.getText();
 } else {
  text = fs.readFileSync(confPath, 'utf-8');
 }

 const includes: string[] = [];
 let match: RegExpExecArray | null;

 while ((match = INCLUDE_REGEX.exec(text)) !== null) {
  const raw = match[1].trim();

  // ✅ ВАЖНО: include часто начинается с "/../" (sphinx-style),
  // это НЕ абсолютный путь ОС, поэтому убираем ведущие слеши
  const cleaned = raw.replace(/^[/\\]+/, '');

  // ✅ Абсолютный путь относительно conf.py
  const full = path.resolve(path.dirname(confPath), cleaned);

  // ✅ Нормализация (гарантирует корректные separators)
  console.log('[INCLUDE]', raw, '=>', full);
  includes.push(path.normalize(full));
 }

 return includes;
}
