import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { discoverProjects } from '../doc/projectRegistry';
import { getEffectiveFilePath } from '../utils/contextResolver';
import { resolveWorkspaceRoot } from '../utils/workspaceResolver';
import { DOC_LINK_RE, normalizeDocTarget, resolveLocalDocTarget } from '../doc/docUtils';
import { findConfPy } from '../project/projectResolver';

export function registerDocDiagnosticsProvider(context: vscode.ExtensionContext) {
 const collection = vscode.languages.createDiagnosticCollection('rst-doc');
 context.subscriptions.push(collection);

 function validate(doc: vscode.TextDocument) {
  if (doc.languageId !== 'restructuredtext') return;

  const effectivePath = getEffectiveFilePath(doc);
  const workspaceRoot = resolveWorkspaceRoot(effectivePath, doc);
  if (!workspaceRoot) return;
  const confPath = findConfPy(effectivePath);

  const diagnostics: vscode.Diagnostic[] = [];
  const text = doc.getText();
  const re = new RegExp(DOC_LINK_RE.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
   const rawInside = match[1];
   const start = doc.positionAt(match.index + 6);
   const end = doc.positionAt(match.index + 6 + rawInside.length);
   const range = new vscode.Range(start, end);

   const normalized = normalizeDocTarget(rawInside);
   if (!normalized) continue;

   if (normalized.includes(':')) {
    const [projectId, relPath] = normalized.split(':', 2);

    const project = discoverProjects(workspaceRoot).find(p => p.id === projectId);
    if (!project) {
     diagnostics.push(new vscode.Diagnostic(
      range,
      `❌ Проект "${projectId}" не найден в source/ru/ru`,
      vscode.DiagnosticSeverity.Error
     ));
     continue;
    }

    const target = path.resolve(project.root, relPath);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
     diagnostics.push(new vscode.Diagnostic(
      range,
      `❌ Файл не найден: ${projectId}:${relPath}`,
      vscode.DiagnosticSeverity.Error
     ));
    }
    continue;
   }

   const localTarget = resolveLocalDocTarget(normalized, effectivePath, confPath);
   if (!fs.existsSync(localTarget) || !fs.statSync(localTarget).isFile()) {
    diagnostics.push(new vscode.Diagnostic(
     range,
     `❌ Файл не найден: ${normalized}`,
     vscode.DiagnosticSeverity.Error
    ));
   }
  }

  collection.set(doc.uri, diagnostics);
 }

 function validateActiveEditor() {
  const doc = vscode.window.activeTextEditor?.document;
  if (doc) validate(doc);
 }

 vscode.workspace.textDocuments.forEach(validate);

 context.subscriptions.push(
  vscode.workspace.onDidOpenTextDocument(validate),
  vscode.workspace.onDidChangeTextDocument(e => validate(e.document)),
  vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri)),
  vscode.window.onDidChangeActiveTextEditor(() => validateActiveEditor())
 );

 setTimeout(() => validateActiveEditor(), 300);
}
