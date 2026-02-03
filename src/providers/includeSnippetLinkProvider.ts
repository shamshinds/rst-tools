// src/providers/includeSnippetLinkProvider.ts
// FIX: marker берём не из парсера, а напрямую из документа, от строки include до первой НЕ-параметр строки

import * as vscode from 'vscode';
import * as fs from 'fs';

import { findConfPy } from '../project/projectResolver';
import { parseIncludeSnippets } from '../parsing/includeSnippetParser';
import { OPEN_INCLUDE_AT_MARKER_CMD } from '../includes/openIncludeAtMarkerCommand';

function findIncludeRange(
 doc: vscode.TextDocument,
 includePathRaw: string
): vscode.Range | null {
 const wanted = includePathRaw.trim();

 for (let lineNo = 0; lineNo < doc.lineCount; lineNo++) {
  const line = doc.lineAt(lineNo).text;

  const inc = line.indexOf('include::');
  if (inc === -1) continue;

  const after = line.slice(inc + 'include::'.length).trim();
  if (!after) continue;

  if (after !== wanted) continue;

  const startChar = line.indexOf(after, inc);
  if (startChar === -1) continue;

  const endChar = startChar + after.length;

  return new vscode.Range(
   new vscode.Position(lineNo, startChar),
   new vscode.Position(lineNo, endChar)
  );
 }

 return null;
}

function extractMarkerFromFollowingParamLines(
 doc: vscode.TextDocument,
 includeLineNo: number
): string | undefined {
 // параметры include идут с отступом:
 // "   :start-after: xxx"
 for (let i = includeLineNo + 1; i < doc.lineCount; i++) {
  const line = doc.lineAt(i).text;

  // если строка не начинается с пробела/таба — параметры закончились
  if (!/^[ \t]+:/.test(line)) break;

  const m = /:start-after:\s*(.+)\s*$/.exec(line);
  if (m) return (m[1] ?? '').trim();
 }

 return undefined;
}

export function registerIncludeSnippetLinkProvider(
 context: vscode.ExtensionContext
) {
 console.log('[INCLUDE LINK] register link provider');

 const provider = vscode.languages.registerDocumentLinkProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   provideDocumentLinks(doc) {
    console.log('[INCLUDE LINK] provideDocumentLinks called for', doc.fileName);

    const confPy = findConfPy(doc.fileName);
    if (!confPy) {
     console.log('[INCLUDE LINK] conf.py not found for', doc.fileName);
     return [];
    }

    const snippets = parseIncludeSnippets(doc.getText(), doc.fileName, confPy);

    console.log('[INCLUDE LINK] snippets found =', snippets.length);

    const links: vscode.DocumentLink[] = [];

    for (const s of snippets) {
     const includeRange = findIncludeRange(doc, s.includePathRaw);
     if (!includeRange) {
      console.log('[INCLUDE LINK] include range not found for', s.includePathRaw);
      continue;
     }

     const includeLineNo = includeRange.start.line;

     // ✅ marker берём напрямую из файла
     const marker = extractMarkerFromFollowingParamLines(doc, includeLineNo);

     const payloadObj = {
      file: s.includeFileAbs,
      marker
     };

     console.log('[INCLUDE LINK] add link', payloadObj);

     const payload = encodeURIComponent(JSON.stringify(payloadObj));
     const cmdUri = vscode.Uri.parse(
      `command:${OPEN_INCLUDE_AT_MARKER_CMD}?${payload}`
     );

     const link = new vscode.DocumentLink(includeRange, cmdUri);

     link.tooltip =
      `Open include: ${s.includeFileAbs}` +
      (marker ? `\nstart-after: ${marker}` : '');

     if (!fs.existsSync(s.includeFileAbs)) {
      link.tooltip = `❌ Файл не найден: ${s.includeFileAbs}`;
     }

     links.push(link);
    }

    return links;
   }
  }
 );

 context.subscriptions.push(provider);
}
