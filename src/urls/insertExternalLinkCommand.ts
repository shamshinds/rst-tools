import * as vscode from 'vscode';

import {
 buildExternalLink,
 looksLikeUrl,
 normalizeLinkText,
 parseDocsUrl
} from '../doc/urlToDoc';
import { getDocsBaseUrls } from '../utils/settings';

export const INSERT_EXTERNAL_LINK_CMD = 'rstTools.insertExternalLink';

/**
 * Оборачивает выделенный текст во внешнюю ссылку RST, подставляя URL
 * из буфера обмена: `текст <url>`__
 */
export function registerInsertExternalLinkCommand(context: vscode.ExtensionContext) {
 const cmd = vscode.commands.registerCommand(INSERT_EXTERNAL_LINK_CMD, async () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
   vscode.window.showErrorMessage('Нет активного редактора');
   return;
  }

  const { document: doc, selection } = editor;

  if (selection.isEmpty) {
   vscode.window.showWarningMessage('Выделите текст, который станет ссылкой');
   return;
  }

  const label = normalizeLinkText(doc.getText(selection));
  if (!label) {
   vscode.window.showWarningMessage(
    'Выделены только пробелы — нечего подставить в текст ссылки'
   );
   return;
  }

  const clipboard = (await vscode.env.clipboard.readText()).trim();
  if (!looksLikeUrl(clipboard)) {
   vscode.window.showWarningMessage(
    'В буфере обмена нет URL — скопируйте ссылку перед вставкой'
   );
   return;
  }

  const applied = await editor.edit(edit =>
   edit.replace(selection, buildExternalLink(label, clipboard))
  );

  if (!applied) {
   vscode.window.showErrorMessage('Не удалось вставить ссылку');
   return;
  }

  // Внутренние ссылки лучше делать ролью :doc: — она проверяется
  // при сборке и переживает переименование файла.
  if (parseDocsUrl(clipboard, getDocsBaseUrls())) {
   vscode.window.showWarningMessage(
    'URL ведет на документацию — для внутренних ссылок лучше роль doc (Ctrl+Shift+D)'
   );
  }
 });

 context.subscriptions.push(cmd);
}
