import * as vscode from 'vscode';
import * as fs from 'fs';

import { indexVariables } from '../variables/variableIndex';
import { OPEN_IMAGE_CMD } from '../images/previewCommand';
import { getEffectiveFilePath } from '../utils/contextResolver';
import { includeContext } from '../providers/includeSnippetHoverProvider';
import { buildLiteralLineSet } from '../utils/rstTextUtils';

export function registerHoverProvider(context: vscode.ExtensionContext) {
 const provider = vscode.languages.registerHoverProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   async provideHover(doc, pos) {
    const range = doc.getWordRangeAtPosition(pos, /\|[^|]+\|/);
    if (!range) return;

    const literalLines = buildLiteralLineSet(doc.getText());
    if (literalLines.has(pos.line)) return;

    const name = doc.getText(range).slice(1, -1);
    const effectivePath = getEffectiveFilePath(doc);
    const vars = await indexVariables(effectivePath);
    const variable = vars.get(name);

    if (!variable) return;

    const parentContext = includeContext.get(doc.fileName);

    if (variable.kind === 'text') {
     const md = new vscode.MarkdownString();
     md.appendMarkdown('```text\n');
     md.appendMarkdown(`${variable.value ?? ''}\n`);
     md.appendMarkdown('```\n\n');
     md.appendMarkdown(`**Источник**: \`${variable.source}\``);
     if (parentContext) {
      md.appendMarkdown(`\n\n**Контекст**: \`${parentContext}\``);
     }
     return new vscode.Hover(md);
    }

    if (variable.kind === 'image' && variable.imagePath) {
     const md = new vscode.MarkdownString();
     md.isTrusted = true;
     md.appendMarkdown(`**${name}** — изображение\n\n`);
     md.appendMarkdown(`**Источник**: \`${variable.source}\``);
     if (parentContext) {
      md.appendMarkdown(`\n\n**Контекст**: \`${parentContext}\``);
     }

     if (!fs.existsSync(variable.imagePath)) return;

     const uri = vscode.Uri.file(variable.imagePath);
     md.appendMarkdown(
      `<img src="${uri.toString()}" ` +
      `style="max-width:360px; max-height:240px; object-fit:contain;` +
      `border-radius:6px; border:1px solid rgba(120,120,120,.25);" />\n\n`
     );
     const fullArg = JSON.stringify(variable.imagePath);
     md.appendMarkdown(
      `[Открыть изображение в новой вкладке](command:${OPEN_IMAGE_CMD}?${encodeURIComponent(fullArg)})\n\n`
     );

     return new vscode.Hover(md);
    }

    return;
   }
  }
 );

 context.subscriptions.push(provider);
}
