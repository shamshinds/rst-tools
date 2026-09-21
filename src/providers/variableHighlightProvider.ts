import * as vscode from 'vscode';

import { indexVariables } from '../variables/variableIndex';
import { getEffectiveFilePath } from '../utils/contextResolver';
import { buildLiteralLineSet } from '../utils/rstTextUtils';
import { isVariableHighlightEnabled } from '../utils/settings';

const decorationType = vscode.window.createTextEditorDecorationType({
 backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
 borderRadius: '2px'
});

export function registerVariableHighlightProvider(context: vscode.ExtensionContext) {
 let timer: ReturnType<typeof setTimeout> | undefined;

 async function decorate(editor: vscode.TextEditor | undefined) {
  if (!editor) return;
  if (editor.document.languageId !== 'restructuredtext') return;

  if (!isVariableHighlightEnabled()) {
   editor.setDecorations(decorationType, []);
   return;
  }

  const doc = editor.document;
  const text = doc.getText();
  const literalLines = buildLiteralLineSet(text);
  const effectivePath = getEffectiveFilePath(doc);
  const vars = await indexVariables(effectivePath);

  const ranges: vscode.Range[] = [];
  const REG = /\|([^|]+)\|/g;
  let match: RegExpExecArray | null;

  while ((match = REG.exec(text)) !== null) {
   const pos = doc.positionAt(match.index);

   if (literalLines.has(pos.line)) {
    REG.lastIndex = match.index + 1;
    continue;
   }
   if (doc.lineAt(pos.line).text.trim().startsWith('.. |')) continue;
   if (!vars.has(match[1])) continue;

   ranges.push(new vscode.Range(pos, doc.positionAt(match.index + match[0].length)));
  }

  editor.setDecorations(decorationType, ranges);
 }

 function scheduleDecorate(editor: vscode.TextEditor | undefined) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => decorate(editor), 150);
 }

 context.subscriptions.push(
  decorationType,
  vscode.window.onDidChangeActiveTextEditor(editor => scheduleDecorate(editor)),
  vscode.workspace.onDidChangeTextDocument(e => {
   if (e.document === vscode.window.activeTextEditor?.document) {
    scheduleDecorate(vscode.window.activeTextEditor);
   }
  }),
  vscode.workspace.onDidChangeConfiguration(e => {
   if (e.affectsConfiguration('rstTools.highlightVariables')) {
    vscode.window.visibleTextEditors.forEach(decorate);
   }
  })
 );

 vscode.window.visibleTextEditors.forEach(decorate);
}
