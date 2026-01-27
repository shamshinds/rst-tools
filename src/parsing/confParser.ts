import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const INCLUDE_REGEX = /^\s*\.\.\s+include::\s+(.+)$/gm;

export async function parseIncludes(confPath: string): Promise<string[]> {
 let text: string;

 const openDoc = vscode.workspace.textDocuments.find(
  d => d.fileName === confPath
 );

 text = openDoc
  ? openDoc.getText()
  : fs.readFileSync(confPath, 'utf-8');

 const includes: string[] = [];
 let match: RegExpExecArray | null;

 while ((match = INCLUDE_REGEX.exec(text)) !== null) {

  const raw = match[1].trim();

  // 🔹 ключевой момент:
  // удаляем только ведущие "/" или "\" ПЕРЕД ".."
  // но не трогаем остальные пути
  const cleaned = raw.replace(/^[/\\]+(?=\.)/, '');

  // 🔹 строим путь как относительный к каталогу conf.py
  const full = path.normalize(
   path.join(path.dirname(confPath), cleaned)
  );

  includes.push(full);
 }

 return includes;
}
