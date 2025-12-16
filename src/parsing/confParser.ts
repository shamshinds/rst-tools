import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const INCLUDE_REGEX = /^\s*\.\.\s+include::\s+(.+)$/gm;

export async function parseIncludes(confPath: string): Promise<string[]> {
 let text: string;

 const openDoc = vscode.workspace.textDocuments.find(
  d => d.fileName === confPath
 );

 if (openDoc) {
  text = openDoc.getText();
 } else {
  text = fs.readFileSync(confPath, 'utf-8');
 }

 const includes: string[] = [];
 let match;

 while ((match = INCLUDE_REGEX.exec(text)) !== null) {
  includes.push(
   path.normalize(
    path.join(path.dirname(confPath), match[1].trim())
   )
  );
 }

 return includes;
}
