import * as vscode from 'vscode';
import * as fs from 'fs';

import { indexVariables } from '../variables/variableIndex';

export function registerDiagnosticsProvider(
 context: vscode.ExtensionContext
) {
 const collection =
  vscode.languages.createDiagnosticCollection('rst-vars');

 context.subscriptions.push(collection);

 async function validate(doc: vscode.TextDocument) {
  if (doc.languageId !== 'restructuredtext') return;

  const vars = await indexVariables(doc.fileName);
  const diags: vscode.Diagnostic[] = [];

  const text = doc.getText();
  const REG = /\|([^|]+)\|/g;

  let match: RegExpExecArray | null;

  while ((match = REG.exec(text)) !== null) {
   const name = match[1];
   const variable = vars.get(name);

   const pos = doc.positionAt(match.index);
   const range = new vscode.Range(pos, pos);

   // не ругаемся на объявление переменной
   if (doc.lineAt(pos.line).text.trim().startsWith('.. |')) {
    continue;
   }

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

   // проверка существования файла изображения
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

 function validateActiveEditor() {
  const doc = vscode.window.activeTextEditor?.document;
  if (doc) validate(doc);
 }

 // ✅ Валидация всех уже открытых документов при активации
 vscode.workspace.textDocuments.forEach(validate);

 context.subscriptions.push(
  vscode.workspace.onDidOpenTextDocument(validate),
  vscode.workspace.onDidChangeTextDocument(e => validate(e.document)),
  vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri)),

  // ✅ Валидация при переключении вкладки/редактора
  vscode.window.onDidChangeActiveTextEditor(() => validateActiveEditor())
 );

 // ✅ Дополнительный прогон после старта (когда всё успело проиндексироваться)
 setTimeout(() => validateActiveEditor(), 300);
}
 