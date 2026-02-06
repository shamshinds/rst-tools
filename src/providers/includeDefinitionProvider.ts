import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { findConfPy } from '../project/projectResolver';

/**
 * Ctrl / Cmd + click переход для include:: с поддержкой start-after
 */
export function registerIncludeDefinitionProvider(
 context: vscode.ExtensionContext
) {
 context.subscriptions.push(
  vscode.languages.registerDefinitionProvider(
   { language: 'restructuredtext', scheme: 'file' },
   {
    async provideDefinition(doc, pos) {

     const info = extractIncludeAtPosition(doc, pos);
     if (!info) return;

     const { file, marker } = info;
     if (!fs.existsSync(file)) return;

     const targetDoc = await vscode.workspace.openTextDocument(file);

     let targetRange = new vscode.Range(0, 0, 0, 0);

     if (marker) {
      const lines = targetDoc.getText().split(/\r?\n/);
      const idx = lines.findIndex(l =>
       l.includes(`{{start-after ${marker}}}`)
      );

      if (idx !== -1) {
       targetRange = new vscode.Range(idx + 1, 0, idx + 1, 0);
      }
     }

     return new vscode.Location(
      targetDoc.uri,
      targetRange
     );
    }
   }
  )
 );
}

/* ===================================================================== */

function extractIncludeAtPosition(
 doc: vscode.TextDocument,
 pos: vscode.Position
): { file: string; marker?: string } | null {

 const line = doc.lineAt(pos.line).text;
 if (!line.includes('.. include::')) return null;

 const fileMatch = line.match(/\.\.\s+include::\s+(.+)/);
 if (!fileMatch) return null;

 const file = resolveIncludePath(fileMatch[1].trim(), doc.fileName);
 let marker: string | undefined;

 for (let i = pos.line + 1; i < doc.lineCount; i++) {
  const l = doc.lineAt(i).text.trim();

  if (l.startsWith(':start-after:')) {
   const m = l.match(/\{\{start-after\s+(.+?)\}\}/);
   if (m) marker = m[1];
  }

  if (!l.startsWith(':')) break;
 }

 return { file, marker };
}

/**
 * Абсолютный путь include
 * /...  → относительно conf.py
 * ./..  → относительно текущего файла
 */
function resolveIncludePath(raw: string, fromFile: string): string {
 if (raw.startsWith('/')) {
  const conf = findConfPy(fromFile);
  if (!conf) return raw;
  return path.normalize(path.join(path.dirname(conf), raw));
 }

 return path.normalize(path.join(path.dirname(fromFile), raw));
}
