import * as vscode from 'vscode';
import * as fs from 'fs';

import { indexVariables } from '../variables/variableIndex';
import { OPEN_IMAGE_CMD } from '../images/previewCommand';

export function registerHoverProvider(
 context: vscode.ExtensionContext
) {
 const provider = vscode.languages.registerHoverProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   async provideHover(doc, pos) {

    const range = doc.getWordRangeAtPosition(pos, /\|[^|]+\|/);
    if (!range) return;

    const name = doc.getText(range).slice(1, -1);
    const vars = await indexVariables(doc.fileName);
    const variable = vars.get(name);

    if (!variable) {
     return new vscode.Hover(`❌ Переменная **${name}** не найдена`);
    }

    // TEXT
    if (variable.kind === 'text') {
     const md = new vscode.MarkdownString();
     //md.appendMarkdown(`**${name}**\n\n`);
     md.appendMarkdown('```text\n');
     md.appendMarkdown(`${variable.value ?? ''}\n`);
     md.appendMarkdown('```\n\n');
     md.appendMarkdown(`**Источник**: \`${variable.source}\``);
     return new vscode.Hover(md);
    }

    // IMAGE
    if (variable.kind === 'image' && variable.imagePath) {
     const md = new vscode.MarkdownString();
     md.isTrusted = true;

     md.appendMarkdown(`**${name}** — изображение\n\n`);
     md.appendMarkdown(`**Источник**: \`${variable.source}\``);

     if (fs.existsSync(variable.imagePath)) {
      const uri = vscode.Uri.file(variable.imagePath);

      // миниатюра = оригинал, но отображаем уменьшенно
      md.appendMarkdown(
       `<img src="${uri.toString()}" ` +
       `style="max-width:360px; max-height:240px; object-fit:contain;` +
       `border-radius:6px; border:1px solid rgba(120,120,120,.25);" />\n\n`
      );

      const fullArg = JSON.stringify(variable.imagePath);

      md.appendMarkdown(
       `[Открыть изображение в новой вкладке](command:${OPEN_IMAGE_CMD}?${encodeURIComponent(fullArg)})\n\n`
      );
     } else {
      md.appendMarkdown(
       `❌ Файл изображения не найден \n\n\`${variable.imagePath}\`\n\n`
      );
     }

     return new vscode.Hover(md);
    }

    return new vscode.Hover(`**${name}** (Неизвестный тип переменной)`);
   }
  }
 );

 context.subscriptions.push(provider);
}
