// src/providers/includeSnippetHoverProvider.ts

import * as vscode from 'vscode';
import * as fs from 'fs';

import { findConfPy } from '../project/projectResolver';
import { parseIncludeSnippets } from '../parsing/includeSnippetParser';

export function registerIncludeSnippetHoverProvider(
 context: vscode.ExtensionContext
) {
 const provider = vscode.languages.registerHoverProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   provideHover(doc, pos) {
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
     // Диапазон ТОЛЬКО пути include::
     const range = new vscode.Range(
      new vscode.Position(s.line, s.columnStart),
      new vscode.Position(s.line, s.columnEnd)
     );

     // Hover только если курсор внутри пути
     if (!range.contains(pos)) {
      continue;
     }
     
     const md = new vscode.MarkdownString();
     md.isTrusted = true;

     if (fs.existsSync(s.includeFileAbs)) {
      //md.appendMarkdown(`**Include snippet**\n\n`);
      md.appendMarkdown(`**Путь к файлу**: \n\`${s.includeFileAbs} ✅\`\n\n`);

      if (s.startAfter) {
       md.appendMarkdown(
        `**Начало фрагмента**: \`${s.startAfter}\`\n\n`
       );
      }

      if (s.endBefore) {
       md.appendMarkdown(
        `**Конец фрагмента**: \`${s.endBefore}\`\n\n`
       );
      }

      //if (!fs.existsSync(s.includeFileAbs)) {
      //md.appendMarkdown(
      //`❌ Файл не найден`
      //);
      //}

     }
     
     return new vscode.Hover(md, range);
    }

    return;
   }
  }
 );

 context.subscriptions.push(provider);
}
