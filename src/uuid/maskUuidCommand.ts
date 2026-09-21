import * as vscode from 'vscode';

import { findUuidMatches } from '../utils/uuidMasker';

export const MASK_UUID_CMD = 'rstTools.maskUuids';

export function registerMaskUuidCommand(context: vscode.ExtensionContext) {
 const cmd = vscode.commands.registerCommand(MASK_UUID_CMD, async () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
   vscode.window.showErrorMessage('Нет активного редактора');
   return;
  }

  const doc = editor.document;
  const matches = findUuidMatches(doc.getText());

  if (matches.length === 0) {
   vscode.window.showInformationMessage('UUID не найдены');
   return;
  }

  // Замена не меняет длину строки, поэтому смещения остальных
  // совпадений не сдвигаются и правки можно применить одной пачкой.
  const applied = await editor.edit(edit => {
   for (const m of matches) {
    const range = new vscode.Range(doc.positionAt(m.start), doc.positionAt(m.end));
    edit.replace(range, m.masked);
   }
  });

  if (!applied) {
   vscode.window.showErrorMessage('Не удалось замаскировать UUID');
   return;
  }

  vscode.window.showInformationMessage(`Замаскировано UUID: ${matches.length}`);
 });

 context.subscriptions.push(cmd);
}
