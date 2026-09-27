import * as vscode from 'vscode';

import {
 parseDocsUrl,
 wrapInDocRole,
 looksLikeUrl,
 normalizeLinkText,
 PLACEHOLDER_DOC_TARGET
} from '../doc/urlToDoc';
import { getEffectiveFilePath } from '../utils/contextResolver';
import { getDocsBaseUrls } from '../utils/settings';
import { URL_REGEX, resolveDocTarget } from './docLinkTarget';

export const INSERT_DOC_LINK_CMD = 'rstTools.insertDocLink';

interface Replacement {
 range: vscode.Range;
 text: string;
 warning?: string;
}

/**
 * Что вставить вместо выделения или URL под курсором.
 *
 * Разбор по случаям:
 *  1. выделен сам URL документации → `:doc:`путь``, без текста ссылки;
 *  2. выделен обычный текст, в буфере URL документации → `:doc:`текст <путь>``;
 *  3. выделен обычный текст, подходящего URL нет → `:doc:`текст <./>``;
 *  4. выделения нет, курсор на URL документации → `:doc:`путь``.
 */
async function planReplacement(
 editor: vscode.TextEditor
): Promise<Replacement | { error: string }> {
 const doc = editor.document;
 const selection = editor.selection;
 const bases = getDocsBaseUrls();
 const effectivePath = getEffectiveFilePath(doc);

 if (!selection.isEmpty) {
  const selected = doc.getText(selection);

  // 1. Выделен сам URL — ведем себя как при курсоре на ссылке.
  const selectedParts = parseDocsUrl(selected, bases);
  if (selectedParts) {
   const { target, warning } = resolveDocTarget(selectedParts, effectivePath, doc);
   return { range: selection, text: wrapInDocRole(target), warning };
  }

  const label = normalizeLinkText(selected);
  if (!label) {
   return { error: 'Выделены только пробелы — нечего подставить в текст ссылки' };
  }

  // 2. Текст ссылки из выделения, цель из буфера обмена.
  const clipboard = (await vscode.env.clipboard.readText()).trim();
  const clipboardParts = parseDocsUrl(clipboard, bases);

  if (clipboardParts) {
   const { target, warning } = resolveDocTarget(clipboardParts, effectivePath, doc);
   return { range: selection, text: wrapInDocRole(target, label), warning };
  }

  // 3. Цели нет — вставляем заглушку, путь дописывает автор.
  const warning = looksLikeUrl(clipboard)
   ? 'URL в буфере обмена не похож на ссылку документации — подставлена заглушка пути'
   : undefined;

  return {
   range: selection,
   text: wrapInDocRole(PLACEHOLDER_DOC_TARGET, label),
   warning
  };
 }

 // 4. Выделения нет — берем URL под курсором.
 const range = doc.getWordRangeAtPosition(selection.active, URL_REGEX);
 if (!range) {
  return {
   error: 'Не найден URL: поставьте курсор на ссылку или выделите текст для ссылки'
  };
 }

 const rawUrl = doc.getText(range).trim();
 const parts = parseDocsUrl(rawUrl, bases);

 if (!parts) {
  return {
   error: `Не удалось разобрать URL как ссылку на документацию: ${rawUrl}`
  };
 }

 const { target, warning } = resolveDocTarget(parts, effectivePath, doc);
 return { range, text: wrapInDocRole(target), warning };
}

export function registerInsertDocLinkCommand(context: vscode.ExtensionContext) {
 const cmd = vscode.commands.registerCommand(INSERT_DOC_LINK_CMD, async () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
   vscode.window.showErrorMessage('Нет активного редактора');
   return;
  }

  const plan = await planReplacement(editor);

  if ('error' in plan) {
   vscode.window.showWarningMessage(plan.error);
   return;
  }

  const applied = await editor.edit(edit => edit.replace(plan.range, plan.text));
  if (!applied) {
   vscode.window.showErrorMessage('Не удалось вставить ссылку');
   return;
  }

  if (plan.warning) {
   vscode.window.showWarningMessage(plan.warning);
  }
 });

 context.subscriptions.push(cmd);
}
