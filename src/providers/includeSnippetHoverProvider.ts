import * as vscode from 'vscode';
import * as fs from 'fs';

import { findConfPy } from '../project/projectResolver';
import { parseIncludeSnippets } from '../parsing/includeSnippetParser';

function getIncludePathRangeOnLine(
 document: vscode.TextDocument,
 position: vscode.Position
): vscode.Range | null {
 const lineText = document.lineAt(position.line).text;

 const idx = lineText.indexOf('include::');
 if (idx === -1) return null;

 const after = lineText.slice(idx + 'include::'.length);
 const raw = after.trim();
 if (!raw) return null;

 const startChar = lineText.indexOf(raw, idx);
 if (startChar === -1) return null;

 const endChar = startChar + raw.length;

 return new vscode.Range(
  new vscode.Position(position.line, startChar),
  new vscode.Position(position.line, endChar)
 );
}

export function registerIncludeSnippetHoverProvider(
 context: vscode.ExtensionContext
) {
 const provider = vscode.languages.registerHoverProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   provideHover(doc, pos) {
    const confPy = findConfPy(doc.fileName);
    if (!confPy) return;

    const range = getIncludePathRangeOnLine(doc, pos);
    if (!range) return;

    if (!range.contains(pos)) return;

    const offset = doc.offsetAt(pos);

    const snippets = parseIncludeSnippets(doc.getText(), doc.fileName, confPy);
    const hit = snippets.find(
     s => offset >= s.rangeStartOffset && offset <= s.rangeEndOffset
    );
    if (!hit) return;

    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    md.appendMarkdown(`**include** → \`${hit.includePathRaw}\`\n\n`);
    md.appendMarkdown(`**Файл:** \`${hit.includeFileAbs}\`\n\n`);

    if (!fs.existsSync(hit.includeFileAbs)) {
     md.appendMarkdown(`❌ Файл не найден\n\n`);
    } else {
     md.appendMarkdown(`✅ Файл найден\n\n`);
    }

    if (hit.startAfter) md.appendMarkdown(`**start-after:** \`${hit.startAfter}\`\n\n`);
    if (hit.endBefore) md.appendMarkdown(`**end-before:** \`${hit.endBefore}\`\n\n`);

    return new vscode.Hover(md, range);
   }
  }
 );

 context.subscriptions.push(provider);
}
