import * as vscode from 'vscode';
import * as fs from 'fs';

import { findConfPy } from '../project/projectResolver';
import { parseIncludeSnippets } from '../parsing/includeSnippetParser';
import { OPEN_INCLUDE_AT_MARKER_CMD } from '../includes/openIncludeAtMarkerCommand';

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
    console.log(
     '[INCLUDE LINK] provideDocumentLinks called for',
     doc.fileName
    );

    const confPy = findConfPy(doc.fileName);
    if (!confPy) {
     console.log('[INCLUDE LINK] conf.py not found for', doc.fileName);
     return [];
    }

    const snippets = parseIncludeSnippets(
     doc.getText(),
     doc.fileName,
     confPy
    );

    console.log('[INCLUDE LINK] snippets found =', snippets.length);

    const links: vscode.DocumentLink[] = [];

    for (const s of snippets) {
     const includeRange = new vscode.Range(
      new vscode.Position(s.line, s.columnStart),
      new vscode.Position(s.line, s.columnEnd)
     );

     // marker читаем из документа (реальное состояние)
     const marker = extractMarkerFromFollowingParamLines(
      doc,
      s.line
     );

     const payloadObj = {
      file: s.includeFileAbs,
      marker
     };

     console.log('[INCLUDE LINK] add link', payloadObj);

     const payload = encodeURIComponent(
      JSON.stringify([payloadObj])
     );

     const cmdUri = vscode.Uri.parse(
      `command:${OPEN_INCLUDE_AT_MARKER_CMD}?${payload}`
     );

     

     if (fs.existsSync(s.includeFileAbs)) {
      const link = new vscode.DocumentLink(includeRange, cmdUri);
      link.tooltip = `Чтобы открыть файл, нажмите на путь к нему с зажатой клавишей Ctrl (Cmd)`;
      //`Open include: ${s.includeFileAbs}` +
      //(marker ? `\nstart-after: ${marker}` : '');
      links.push(link);
     } 

     //if (!fs.existsSync(s.includeFileAbs)) {
      //link.tooltip = `❌ Файл не найден: ${s.includeFileAbs}`;
     //}

     //links.push(link);
    }

    return links;
   }
  }
 );

 context.subscriptions.push(provider);
}
