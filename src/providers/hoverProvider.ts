import * as vscode from 'vscode';
import { indexVariables } from '../variables/variableIndex';

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

    return new vscode.Hover([
     `**${name}**`,
     '```',
     variable.value,
     '```',
     `Источник: ${variable.source}`
    ]);
   }
  }
 );

 context.subscriptions.push(provider);
}
