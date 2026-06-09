import * as vscode from 'vscode';
import * as fs from 'fs';

import { indexVariables } from '../variables/variableIndex';
import { getEffectiveFilePath } from '../utils/contextResolver';

export function registerDiagnosticsProvider(context: vscode.ExtensionContext) {
 const collection = vscode.languages.createDiagnosticCollection('rst-vars');
 context.subscriptions.push(collection);

 async function validate(doc: vscode.TextDocument) {
  if (doc.languageId !== 'restructuredtext') return;

  const effectivePath = getEffectiveFilePath(doc);
  const vars = await indexVariables(effectivePath);

  const diags: vscode.Diagnostic[] = [];
  const text = doc.getText();
  const REG = /\|([^|]+)\|/g;

  let match: RegExpExecArray | null;

  while ((match = REG.exec(text)) !== null) {
   const name = match[1];
   const variable = vars.get(name);
   const range = new vscode.Range(
    doc.positionAt(match.index),
    doc.positionAt(match.index + match[0].length)
   );

   if (doc.lineAt(doc.positionAt(match.index).line).text.trim().startsWith('.. |')) continue;

   if (!variable) {
    diags.push(new vscode.Diagnostic(
     range,
     `Переменная "${name}" не определена`,
     vscode.DiagnosticSeverity.Error
    ));
    continue;
   }

   if (variable.kind === 'image' && variable.imagePath && !fs.existsSync(variable.imagePath)) {
    diags.push(new vscode.Diagnostic(
     range,
     `Файл изображения не найден: ${variable.imagePath}`,
     vscode.DiagnosticSeverity.Error
    ));
   }
  }

  collection.set(doc.uri, diags);
 }

 function validateActiveEditor() {
  const doc = vscode.window.activeTextEditor?.document;
  if (doc) validate(doc);
 }

 vscode.workspace.textDocuments.forEach(validate);

 context.subscriptions.push(
  vscode.workspace.onDidOpenTextDocument(validate),
  vscode.workspace.onDidChangeTextDocument(e => validate(e.document)),
  vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri)),
  vscode.window.onDidChangeActiveTextEditor(() => validateActiveEditor())
 );

 setTimeout(() => validateActiveEditor(), 300);
}
