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
    if (!confPy) return;

    const snippets = parseIncludeSnippets(
     doc.getText(),
     doc.fileName,
     confPy
    );

    const offset = doc.offsetAt(pos);

    const hit = snippets.find(
     s => offset >= s.rangeStartOffset && offset <= s.rangeEndOffset
    );
    if (!hit) return;

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**Include**\n\n`);
    md.appendMarkdown(`Файл: \`${hit.includeFileAbs}\`\n\n`);

    if (hit.startAfter) md.appendMarkdown(`start-after: \`${hit.startAfter}\`\n\n`);
    if (hit.endBefore) md.appendMarkdown(`end-before: \`${hit.endBefore}\`\n\n`);

    if (!fs.existsSync(hit.includeFileAbs)) {
     md.appendMarkdown(`❌ Файл не найден`);
    }

    return new vscode.Hover(md);
   }
  }
 );

 context.subscriptions.push(provider);
}
