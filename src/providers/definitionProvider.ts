import * as vscode from 'vscode';
import { indexVariables } from '../variables/variableIndex';

export function registerDefinitionProvider(
 context: vscode.ExtensionContext
) {
 const provider = vscode.languages.registerDefinitionProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   async provideDefinition(doc, pos) {
    const range = doc.getWordRangeAtPosition(pos, /\|[^|]+\|/);
    if (!range) return;

    const name = doc.getText(range).slice(1, -1);
    const vars = await indexVariables(doc.fileName);
    const variable = vars.get(name);

    if (!variable) return;

    const targetDoc =
     await vscode.workspace.openTextDocument(variable.source);

    const text = targetDoc.getText();
    const defRegex =
     new RegExp(`^\\.\\.\\s+\\|${name}\\|\\s+replace::`, 'm');

    const match = defRegex.exec(text);
    if (!match) return;

    const posInFile = targetDoc.positionAt(match.index);
    return new vscode.Location(
     targetDoc.uri,
     new vscode.Range(posInFile, posInFile)
    );
   }
  }
 );

 context.subscriptions.push(provider);
}
