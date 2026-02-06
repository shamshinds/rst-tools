// src/providers/includeSnippetDiagnosticsProvider.ts

import * as vscode from 'vscode';
import * as fs from 'fs';

import { findConfPy } from '../project/projectResolver';
import { parseIncludeSnippets } from '../parsing/includeSnippetParser';

export function registerIncludeSnippetDiagnosticsProvider(
 context: vscode.ExtensionContext
) {
 const collection =
  vscode.languages.createDiagnosticCollection('rst-include-snippets');

 context.subscriptions.push(collection);

 function validate(doc: vscode.TextDocument) {
  if (doc.languageId !== 'restructuredtext') {
   return;
  }

  const confPy = findConfPy(doc.fileName);
  if (!confPy) {
   collection.delete(doc.uri);
   return;
  }

  const diagnostics: vscode.Diagnostic[] = [];

  const snippets = parseIncludeSnippets(
   doc.getText(),
   doc.fileName,
   confPy
  );

  for (const s of snippets) {
   // Диапазон — ТОЛЬКО путь include:: на строке
   const range = new vscode.Range(
    new vscode.Position(s.line, s.columnStart),
    new vscode.Position(s.line, s.columnEnd)
   );

   // --- файл include не найден ---
   if (!fs.existsSync(s.includeFileAbs)) {
    diagnostics.push(
     new vscode.Diagnostic(
      range,
      `❌ Файл не найден: ${s.includeFileAbs}`,
      vscode.DiagnosticSeverity.Error
     )
    );
    continue;
   }

   // --- проверка start-after ---
   if (s.startAfter) {
    try {
     const text = fs.readFileSync(s.includeFileAbs, 'utf-8');
     if (!text.includes(s.startAfter)) {
      diagnostics.push(
       new vscode.Diagnostic(
        range,
        `❌ Не удалось найти начало фрагмента: ${s.startAfter}`,
        vscode.DiagnosticSeverity.Error
       )
      );
     }
    } catch {
     diagnostics.push(
      new vscode.Diagnostic(
       range,
       `❌ Невозможно прочитать файл: ${s.includeFileAbs}`,
       vscode.DiagnosticSeverity.Error
      )
     );
    }
   }

   // --- проверка end-before ---
   if (s.endBefore) {
    try {
     const text = fs.readFileSync(s.includeFileAbs, 'utf-8');
     if (!text.includes(s.endBefore)) {
      diagnostics.push(
       new vscode.Diagnostic(
        range,
        `❌ Не удалось найти конец фрагмента: ${s.endBefore}`,
        vscode.DiagnosticSeverity.Warning
       )
      );
     }
    } catch {
     // уже обработано выше
    }
   }
  }

  collection.set(doc.uri, diagnostics);
 }

 context.subscriptions.push(
  vscode.workspace.onDidOpenTextDocument(validate),
  vscode.workspace.onDidChangeTextDocument(e => validate(e.document)),
  vscode.workspace.onDidCloseTextDocument(doc =>
   collection.delete(doc.uri)
  )
 );

 vscode.workspace.textDocuments.forEach(validate);
}
