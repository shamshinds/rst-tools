import * as vscode from 'vscode';
import { indexVariables } from '../variables/variableIndex';

export function registerCompletionProvider(
 context: vscode.ExtensionContext
) {
 const provider = vscode.languages.registerCompletionItemProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   async provideCompletionItems(doc, pos) {
    console.log('[RST] provideCompletionItems called');
    const line = doc.lineAt(pos).text.slice(0, pos.character);
    if (!line.endsWith('|')) return;

    const vars = await indexVariables(doc.fileName);

    return [...vars.values()].map(v => {
     const item = new vscode.CompletionItem(
      v.name,
      vscode.CompletionItemKind.Variable
     );
     item.insertText = `${v.name}|`;
     item.detail = v.value;
     item.documentation = new vscode.MarkdownString(
      `**Источник:** \`${v.source}\`\n\n${v.value}`
     );
     return item;
    });
   }
  },
  '|'
 );

 context.subscriptions.push(provider);
}
