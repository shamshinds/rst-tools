import * as vscode from 'vscode';
import * as fs from 'fs';

import { indexVariables } from '../variables/variableIndex';

export function registerDiagnosticsProvider(
 context: vscode.ExtensionContext
) {
 const collection =
  vscode.languages.createDiagnosticCollection('rst-vars');

 async function validate(doc: vscode.TextDocument) {
  if (doc.languageId !== 'restructuredtext') return;

  const vars = await indexVariables(doc.fileName);
  const diags: vscode.Diagnostic[] = [];

  const text = doc.getText();
  const REG = /\|([^|]+)\|/g;

  let match;

  while ((match = REG.exec(text)) !== null) {
   const name = match[1];
   const variable = vars.get(name);

   const pos = doc.positionAt(match.index);
   const range = new vscode.Range(pos, pos);

   // ---------------------------------------
   // Пропускаем строку, где переменная объявляется
   // ---------------------------------------
   if (doc.lineAt(pos.line).text.trim().startsWith('.. |')) {
    continue;
   }

   // ---------------------------------------
   // Переменная не найдена
   // ---------------------------------------
   if (!variable) {
    diags.push(
     new vscode.Diagnostic(
      range,
      `Переменная "${name}" не определена`,
      vscode.DiagnosticSeverity.Error
     )
    );
    continue;
   }

   /* ======================================================
    *  ПОДДЕРЖКА ПЕРЕМЕННЫХ-КАРТИНОК (image:: ...)
    *  Проверяем, что файл реально существует
    * ====================================================== */
   if (variable.kind === 'image' && variable.imagePath) {
    if (!fs.existsSync(variable.imagePath)) {
     diags.push(
      new vscode.Diagnostic(
       range,
       `Файл изображения не найден: ${variable.imagePath}`,
       vscode.DiagnosticSeverity.Error
      )
     );
    }
   }
  }

  collection.set(doc.uri, diags);
 }

 vscode.workspace.textDocuments.forEach(validate);

 context.subscriptions.push(
  vscode.workspace.onDidOpenTextDocument(validate),
  vscode.workspace.onDidChangeTextDocument(e => validate(e.document)),
  vscode.workspace.onDidCloseTextDocument(doc =>
   collection.delete(doc.uri)
  )
 );
}
