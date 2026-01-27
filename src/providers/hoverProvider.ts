import * as vscode from 'vscode';
import * as fs from 'fs';

import { indexVariables } from '../variables/variableIndex';
import { ensureThumb } from '../images/thumbnailCache';
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

    /* =======================================================
     * TEXT VARIABLES — оставляем существующее поведение
     * ======================================================= */
    if (variable.kind === 'text') {
     return new vscode.Hover([
      `**${name}**`,
      '```',
      variable.value ?? '',
      '```',
      `Источник: ${variable.source}`
     ]);
    }

    /* =======================================================
     * IMAGE VARIABLES — миниатюра + кнопка "Открыть"
     * ======================================================= */
    if (variable.kind === 'image' && variable.imagePath) {

     const md = new vscode.MarkdownString();
     md.isTrusted = true;

     md.appendMarkdown(`**${name}** — изображение\n\n`);

     if (fs.existsSync(variable.imagePath)) {

      // генерируем (или берём из кеша) превью
      const thumbPath = await ensureThumb(variable.imagePath);
      const thumbUri = vscode.Uri.file(thumbPath);

      // ссылка-команда на оригинал
      const fullArg = JSON.stringify(variable.imagePath);

      md.appendMarkdown(
       `![thumbnail](${thumbUri.toString()})\n\n` +
       `[Открыть полноразмерное изображение](command:${OPEN_IMAGE_CMD}?${encodeURIComponent(fullArg)})\n\n`
      );

     } else {
      md.appendMarkdown(
       `_Файл изображения не найден_\n\n${variable.imagePath}\n\n`
      );
     }

     md.appendMarkdown(`Источник: ${variable.source}`);
     return new vscode.Hover(md);
    }

    // fallback для неизвестных типов
    return new vscode.Hover(`**${name}** (Неизвестный тип переменной)`);
   }
  }
 );

 context.subscriptions.push(provider);
}
