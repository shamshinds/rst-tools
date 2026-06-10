import * as vscode from 'vscode';

import { resolveWorkspaceRoot } from '../utils/workspaceResolver';
import { getEffectiveFilePath } from '../utils/contextResolver';
import { findGlossaryDir, parseGlossaryDir } from '../parsing/glossaryParser';

// Matches :term:`термин` and :term:`текст <термин>`
const TERM_RE = /:term:`([^`]+)`/g;

function extractTermName(raw: string): string {
 const lt = raw.lastIndexOf('<');
 const gt = raw.lastIndexOf('>');
 if (lt !== -1 && gt !== -1 && gt > lt) {
  return raw.slice(lt + 1, gt).trim();
 }
 return raw.trim();
}

function diagnose(
 doc: vscode.TextDocument,
 collection: vscode.DiagnosticCollection
) {
 if (doc.languageId !== 'restructuredtext') return;

 const effectivePath = getEffectiveFilePath(doc);
 const workspaceRoot = resolveWorkspaceRoot(effectivePath, doc);
 if (!workspaceRoot) return;

 const glossaryDir = findGlossaryDir(workspaceRoot);
 if (!glossaryDir) return;

 const terms = parseGlossaryDir(glossaryDir);
 const termSet = new Set(terms.map(t => t.term.toLowerCase()));

 const diagnostics: vscode.Diagnostic[] = [];

 for (let i = 0; i < doc.lineCount; i++) {
  const line = doc.lineAt(i).text;
  let match: RegExpExecArray | null;
  TERM_RE.lastIndex = 0;

  while ((match = TERM_RE.exec(line)) !== null) {
   const raw = match[1];
   const termText = extractTermName(raw);
   if (!termSet.has(termText.toLowerCase())) {
    // Underline only the term part (inside <> if present, otherwise the whole content)
    const contentStart = match.index + ':term:`'.length;
    const lt = raw.lastIndexOf('<');
    const gt = raw.lastIndexOf('>');
    const termStart = lt !== -1 && gt > lt
     ? contentStart + lt + 1
     : contentStart;
    const termEnd = lt !== -1 && gt > lt
     ? contentStart + gt
     : contentStart + raw.length;

    const diag = new vscode.Diagnostic(
     new vscode.Range(
      new vscode.Position(i, termStart),
      new vscode.Position(i, termEnd)
     ),
     `Термин "${termText}" не найден в глоссарии`,
     vscode.DiagnosticSeverity.Warning
    );
    diag.source = 'rst-term';
    diagnostics.push(diag);
   }
  }
 }

 collection.set(doc.uri, diagnostics);
}

export function registerTermDiagnosticsProvider(context: vscode.ExtensionContext) {
 const collection = vscode.languages.createDiagnosticCollection('rst-term');
 context.subscriptions.push(collection);

 if (vscode.window.activeTextEditor) {
  diagnose(vscode.window.activeTextEditor.document, collection);
 }

 context.subscriptions.push(
  vscode.workspace.onDidOpenTextDocument(doc => diagnose(doc, collection)),
  vscode.workspace.onDidChangeTextDocument(e => diagnose(e.document, collection)),
  vscode.workspace.onDidSaveTextDocument(doc => diagnose(doc, collection)),
  vscode.window.onDidChangeActiveTextEditor(e => {
   if (e) diagnose(e.document, collection);
  })
 );
}
