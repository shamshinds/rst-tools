import * as vscode from 'vscode';
import * as fs from 'fs';

import { findConfPy } from '../project/projectResolver';
import { parseIncludeSnippets } from '../parsing/includeSnippetParser';

export const includeContext = new Map<string, string>();

function getEffectiveFilePath(doc: vscode.TextDocument): string {
 return includeContext.get(doc.fileName) ?? doc.fileName;
}

function extractSnippet(content: string, startAfter?: string, endBefore?: string): string {
 const lines = content.split('\n');
 let start = 0;
 let end = lines.length;

 if (startAfter) {
  const idx = lines.findIndex(l => l.includes(startAfter));
  if (idx !== -1) start = idx + 1;
 }

 if (endBefore) {
  const idx = lines.findIndex(l => l.includes(endBefore));
  if (idx !== -1) end = idx;
 }

 return lines.slice(start, end).join('\n');
}

function registerOpenFileCommand(context: vscode.ExtensionContext) {
 const cmd = vscode.commands.registerCommand(
  'rstTools.openIncludeFile',
  async (args?: [{ file: string; marker?: string; parent?: string }]) => {
   const arg = args?.[0];
   if (!arg?.file) return;

   const { file: filePath, parent: parentPath, marker } = arg;

   if (parentPath) {
    includeContext.set(filePath, parentPath);
   }

   try {
    const doc = await vscode.workspace.openTextDocument(filePath);
    const editor = await vscode.window.showTextDocument(doc, { preview: false });

    if (marker) {
     const idx = doc.getText().indexOf(marker);
     if (idx !== -1) {
      const pos = doc.positionAt(idx);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
     }
    }
   } catch {
    vscode.window.showErrorMessage(`Файл не найден: ${filePath}`);
   }
  }
 );

 context.subscriptions.push(cmd);
}

export function registerIncludeSnippetHoverProvider(context: vscode.ExtensionContext) {
 registerOpenFileCommand(context);

 const provider = vscode.languages.registerHoverProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   provideHover(doc, pos) {
    const confPy = findConfPy(getEffectiveFilePath(doc));
    if (!confPy) return;

    const snippets = parseIncludeSnippets(doc.getText(), doc.fileName, confPy);

    for (const s of snippets) {
     const range = new vscode.Range(
      new vscode.Position(s.line, s.columnStart),
      new vscode.Position(s.line, s.columnEnd)
     );

     if (!range.contains(pos)) continue;

     const md = new vscode.MarkdownString();
     md.isTrusted = true;

     if (fs.existsSync(s.includeFileAbs)) {
      md.appendMarkdown(`**Путь к файлу**: ✅ \n\`${s.includeFileAbs}\`\n\n`);

      if (s.startAfter) md.appendMarkdown(`**Начало фрагмента**: \`${s.startAfter}\`\n\n`);
      if (s.endBefore) md.appendMarkdown(`**Конец фрагмента**: \`${s.endBefore}\`\n\n`);

      try {
       const content = fs.readFileSync(s.includeFileAbs, 'utf8');
       const preview = extractSnippet(content, s.startAfter, s.endBefore)
        .split('\n')
        .slice(0, 3)
        .join('\n');

       md.appendMarkdown('---\n');
       md.appendCodeblock(preview, 'rst');
      } catch {
       md.appendMarkdown('❌ Ошибка чтения файла');
      }
     }

     return new vscode.Hover(md, range);
    }
   }
  }
 );

 context.subscriptions.push(provider);
}
