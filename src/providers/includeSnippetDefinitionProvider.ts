// src/providers/includeSnippetDefinitionProvider.ts

import * as vscode from 'vscode';
import * as fs from 'fs';

import { findConfPy } from '../project/projectResolver';
import { parseIncludeSnippets } from '../parsing/includeSnippetParser';

/**
 * DefinitionProvider для конструкции:
 * .. include:: path
 *    :start-after: {{marker}}
 *
 * Ctrl / Cmd + click:
 *  - открывает файл include
 *  - ставит курсор на строку с marker (если указан)
 */
export function registerIncludeSnippetDefinitionProvider(
 context: vscode.ExtensionContext
) {
 console.log('[INCLUDE DEF] register definition provider');

 const provider = vscode.languages.registerDefinitionProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   async provideDefinition(doc, pos) {
    console.log('[INCLUDE DEF] provideDefinition called');

    const confPy = findConfPy(doc.fileName);
    if (!confPy) {
     return;
    }

    const snippets = parseIncludeSnippets(
     doc.getText(),
     doc.fileName,
     confPy
    );

    for (const s of snippets) {
     // ⬇️ Проверяем, что клик был именно по пути include
     if (pos.line !== s.line) {
      continue;
     }

     if (pos.character < s.columnStart || pos.character > s.columnEnd) {
      continue;
     }

     if (!fs.existsSync(s.includeFileAbs)) {
      return;
     }

     const targetUri = vscode.Uri.file(s.includeFileAbs);

     // --- если marker НЕ указан → просто открыть файл ---
     if (!s.startAfter) {
      return new vscode.Location(
       targetUri,
       new vscode.Position(0, 0)
      );
     }

     // --- marker указан → ищем строку ---
     const targetDoc = await vscode.workspace.openTextDocument(targetUri);

     for (let i = 0; i < targetDoc.lineCount; i++) {
      const lineText = targetDoc.lineAt(i).text;
      if (lineText.includes(s.startAfter)) {
       return new vscode.Location(
        targetUri,
        new vscode.Position(i + 1, 0) // +1 — после marker
       );
      }
     }

     // marker не найден → открываем файл с начала
     return new vscode.Location(
      targetUri,
      new vscode.Position(0, 0)
     );
    }

    return;
   }
  }
 );

 context.subscriptions.push(provider);
}
