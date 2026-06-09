import * as vscode from 'vscode';
import { indexVariables } from '../variables/variableIndex';
import { getEffectiveFilePath } from '../utils/contextResolver';
import { includeContext } from '../providers/includeSnippetHoverProvider';

export function registerCompletionProvider(context: vscode.ExtensionContext) {
 const provider = vscode.languages.registerCompletionItemProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   async provideCompletionItems(doc, pos) {
    const line = doc.lineAt(pos).text.slice(0, pos.character);
    if (!line.endsWith('|')) return;

    const effectivePath = getEffectiveFilePath(doc);
    const vars = await indexVariables(effectivePath);

    return [...vars.values()].map(v => {
     const item = new vscode.CompletionItem(v.name, vscode.CompletionItemKind.Variable);
     item.insertText = `${v.name}|`;
     item.detail = v.value;

     const md = new vscode.MarkdownString();
     md.appendMarkdown(`**Источник:** \`${v.source}\`\n\n${v.value}`);

     const parent = includeContext.get(doc.fileName);
     if (parent) {
      md.appendMarkdown(`\n\n---\n**Контекст:** \`${parent}\``);
     }

     item.documentation = md;
     return item;
    });
   }
  },
  '|'
 );

 context.subscriptions.push(provider);
}
