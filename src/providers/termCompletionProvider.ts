import * as vscode from 'vscode';

import { resolveWorkspaceRoot } from '../utils/workspaceResolver';
import { getEffectiveFilePath } from '../utils/contextResolver';
import { findGlossaryDir, parseGlossaryDir } from '../parsing/glossaryParser';

// Maps Latin confusables to their Cyrillic equivalents for search normalization.
// Handles mixed-script glossary entries like "Aгент" (Latin A + Cyrillic).
const LATIN_TO_CYRILLIC: Record<string, string> = {
 'a': 'а', 'e': 'е', 'o': 'о', 'p': 'р', 'c': 'с', 'x': 'х', 'y': 'у',
 'A': 'А', 'B': 'В', 'C': 'С', 'E': 'Е', 'K': 'К', 'M': 'М',
 'O': 'О', 'P': 'Р', 'T': 'Т', 'X': 'Х',
};

function normalizeScript(s: string): string {
 return s.replace(/[a-zA-Z]/g, ch => LATIN_TO_CYRILLIC[ch] ?? ch).toLowerCase();
}

/**
 * Returns the range to replace for completion.
 * Handles both :term:`термин` and :term:`текст <термин>` forms.
 * In the second form, completion replaces only the part after `<`.
 */
function getTermCompletionRange(
 document: vscode.TextDocument,
 position: vscode.Position
): vscode.Range | null {
 const line = document.lineAt(position.line).text;
 const anchor = ':term:`';

 const idx = line.lastIndexOf(anchor, position.character);
 if (idx === -1) return null;

 const contentStart = idx + anchor.length;
 if (position.character < contentStart) return null;

 const rawSoFar = line.slice(contentStart, position.character);
 const ltIdx = rawSoFar.lastIndexOf('<');

 // Inside `text <term` — replace from after `<`
 if (ltIdx !== -1) {
  return new vscode.Range(
   new vscode.Position(position.line, contentStart + ltIdx + 1),
   position
  );
 }

 return new vscode.Range(
  new vscode.Position(position.line, contentStart),
  position
 );
}

function isInsideTermRole(line: string, character: number): boolean {
 const anchor = ':term:`';
 const idx = line.lastIndexOf(anchor, character);
 if (idx === -1) return false;

 const contentStart = idx + anchor.length;
 if (character < contentStart) return false;

 // Make sure the role isn't already closed before the cursor
 const closing = line.indexOf('`', contentStart);
 return closing === -1 || character <= closing;
}

export function registerTermCompletionProvider(context: vscode.ExtensionContext) {
 const provider = vscode.languages.registerCompletionItemProvider(
  { language: 'restructuredtext', scheme: 'file' },
  {
   provideCompletionItems(doc, pos) {
    const range = getTermCompletionRange(doc, pos);
    if (!range) return;

    const rawTyped = doc.getText(range);
    const typedNorm = normalizeScript(rawTyped);
    const effectivePath = getEffectiveFilePath(doc);
    const workspaceRoot = resolveWorkspaceRoot(effectivePath, doc);
    if (!workspaceRoot) return;

    const glossaryDir = findGlossaryDir(workspaceRoot);
    if (!glossaryDir) return;

    const terms = parseGlossaryDir(glossaryDir);
    const items: vscode.CompletionItem[] = [];

    for (const t of terms) {
     if (typedNorm && !normalizeScript(t.term).includes(typedNorm)) continue;

     const item = new vscode.CompletionItem(t.term, vscode.CompletionItemKind.Reference);
     item.range = range;
     item.insertText = t.term;
     item.filterText = t.term;
     if (t.definition) {
      item.detail = t.definition.length > 120 ? t.definition.slice(0, 120) + '…' : t.definition;
     }
     items.push(item);
    }

    // isIncomplete=true re-invokes provider on every keystroke while session is active
    return new vscode.CompletionList(items, true);
   }
  },
  '`', ' ', '<'
 );

 // When the completion session ends (e.g. after accepting a term) and the user
 // edits inside :term:`...` again, VS Code won't restart the session on its own.
 // We detect the change and programmatically re-trigger suggest.
 const triggerListener = vscode.workspace.onDidChangeTextDocument(event => {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document !== event.document) return;
  if (event.document.languageId !== 'restructuredtext') return;

  const pos = editor.selection.active;
  const line = event.document.lineAt(pos.line).text;

  if (isInsideTermRole(line, pos.character)) {
   vscode.commands.executeCommand('editor.action.triggerSuggest');
  }
 });

 context.subscriptions.push(provider, triggerListener);
}
