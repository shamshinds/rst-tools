import * as vscode from 'vscode';
import * as fs from 'fs';

import { findConfPy } from '../project/projectResolver';
import { parseIncludeSnippets } from '../parsing/includeSnippetParser';

function markerExists(text: string, marker?: string): boolean {
 if (!marker) return true;
 return text.includes(marker);
}

export function registerIncludeSnippetDiagnosticsProvider(
 context: vscode.ExtensionContext
) {
 const collection =
  vscode.languages.createDiagnosticCollection('rst-include-snippets');

 context.subscriptions.push(collection);

 function validate(doc: vscode.TextDocument) {
  if (doc.languageId !== 'restructuredtext') return;

  const confPy = findConfPy(doc.fileName);
  if (!confPy) return;

  const snippets = parseIncludeSnippets(doc.getText(), doc.fileName, confPy);

  const diags: vscode.Diagnostic[] = [];

  for (const s of snippets) {
   const start = doc.positionAt(s.rangeStartOffset);
   const end = doc.positionAt(s.rangeEndOffset);
   const range = new vscode.Range(start, end);

   if (!fs.existsSync(s.includeFileAbs)) {
    diags.push(
     new vscode.Diagnostic(
      range,
      `Include файл не найден: ${s.includeFileAbs}`,
      vscode.DiagnosticSeverity.Error
     )
    );
    continue;
   }

   // ✅ FIX: запрещаем readFileSync на директорию
   let stat: fs.Stats;
   try {
    stat = fs.statSync(s.includeFileAbs);
   } catch {
    diags.push(
     new vscode.Diagnostic(
      range,
      `Include путь недоступен: ${s.includeFileAbs}`,
      vscode.DiagnosticSeverity.Error
     )
    );
    continue;
   }

   if (!stat.isFile()) {
    diags.push(
     new vscode.Diagnostic(
      range,
      `Include путь должен быть файлом, но это не файл: ${s.includeFileAbs}`,
      vscode.DiagnosticSeverity.Error
     )
    );
    continue;
   }

   let content = '';
   try {
    content = fs.readFileSync(s.includeFileAbs, 'utf-8');
   } catch {
    diags.push(
     new vscode.Diagnostic(
      range,
      `Не удалось прочитать include файл: ${s.includeFileAbs}`,
      vscode.DiagnosticSeverity.Error
     )
    );
    continue;
   }

   if (!markerExists(content, s.startAfter)) {
    diags.push(
     new vscode.Diagnostic(
      range,
      `start-after маркер не найден: ${s.startAfter}`,
      vscode.DiagnosticSeverity.Error
     )
    );
   }

   if (!markerExists(content, s.endBefore)) {
    diags.push(
     new vscode.Diagnostic(
      range,
      `end-before маркер не найден: ${s.endBefore}`,
      vscode.DiagnosticSeverity.Error
     )
    );
   }
  }

  collection.set(doc.uri, diags);
 }

 vscode.workspace.textDocuments.forEach(validate);

 context.subscriptions.push(
  vscode.workspace.onDidOpenTextDocument(validate),
  vscode.workspace.onDidChangeTextDocument(e => validate(e.document)),
  vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri))
 );
}
