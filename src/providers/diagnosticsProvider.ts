import * as vscode from 'vscode';
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

  const REG = /\|([^|]+)\|/g;
  let match;

  while ((match = REG.exec(doc.getText())) !== null) {
   if (!vars.has(match[1])) {
    const pos = doc.positionAt(match.index);
    if (doc.lineAt(pos.line).text.trim().startsWith('.. |')) {
     continue;
    }
    diags.push(
     new vscode.Diagnostic(
      new vscode.Range(pos, pos),
      `Переменная "${match[1]}" не определена`,
      vscode.DiagnosticSeverity.Error
     )
    );
   }
  }

  collection.set(doc.uri, diags);
 }

 context.subscriptions.push(
  vscode.workspace.onDidOpenTextDocument(validate),
  vscode.workspace.onDidChangeTextDocument(e => validate(e.document))
 );
}
