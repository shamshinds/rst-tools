// src/providers/docDiagnosticsProvider.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { findConfPy } from '../project/projectResolver';
import { parseIntersphinxMapping } from '../doc/docResolver';
import { discoverProjects } from '../doc/projectRegistry';

const DOC_LINK_REGEX = /:doc:`([^`]+)`/g;

/* ======================= helpers ======================= */

function getWorkspaceRoot(doc: vscode.TextDocument): string | null {
 const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
 return folder ? folder.uri.fsPath : null;
}

function resolveWorkspaceRootFromFile(filePath: string): string | null {
 let dir = path.dirname(filePath);

 while (true) {
  const candidate = path.join(dir, 'source', 'ru', 'ru');
  if (fs.existsSync(candidate)) {
   return dir;
  }

  const parent = path.dirname(dir);
  if (parent === dir) break;
  dir = parent;
 }

 return null;
}

/* ======================= provider ======================= */

export function registerDocDiagnosticsProvider(
 context: vscode.ExtensionContext
) {
 const collection =
  vscode.languages.createDiagnosticCollection('rst-doc');

 context.subscriptions.push(collection);

 function validate(doc: vscode.TextDocument) {
  if (doc.languageId !== 'restructuredtext') return;

  const workspaceRoot =
   getWorkspaceRoot(doc) ??
   resolveWorkspaceRootFromFile(doc.fileName);
  if (!workspaceRoot) return;

  const diagnostics: vscode.Diagnostic[] = [];
  const text = doc.getText();

  let match: RegExpExecArray | null;

  while ((match = DOC_LINK_REGEX.exec(text)) !== null) {
   const link = match[1];
   const start = doc.positionAt(match.index + 6);
   const end = doc.positionAt(match.index + 6 + link.length);
   const range = new vscode.Range(start, end);

   /* ---------------------- EXTERNAL ---------------------- */

   if (link.includes(':')) {
    const [projectId, relPath] = link.split(':', 2);

    const confPy = findConfPy(doc.fileName);
    if (!confPy) continue;

    const allowed = parseIntersphinxMapping(confPy);
    const projects = discoverProjects(workspaceRoot);

    const project = projects.find(
     p => p.id === projectId && allowed.has(p.id)
    );

    if (!project) {
     diagnostics.push(
      new vscode.Diagnostic(
       range,
       `Проект '${projectId}' не подключён через intersphinx_mapping`,
       vscode.DiagnosticSeverity.Error
      )
     );
     continue;
    }

    const target = path.resolve(project.root, relPath);
    if (!fs.existsSync(target)) {
     diagnostics.push(
      new vscode.Diagnostic(
       range,
       'Файл не найден в проекте',
       vscode.DiagnosticSeverity.Error
      )
     );
    }

    continue;
   }

   /* ----------------------- LOCAL ------------------------ */

   const target = path.resolve(
    path.dirname(doc.fileName),
    link
   );

   if (!fs.existsSync(target)) {
    diagnostics.push(
     new vscode.Diagnostic(
      range,
      'Файл не найден',
      vscode.DiagnosticSeverity.Error
     )
    );
   }
  }

  collection.set(doc.uri, diagnostics);
 }

 vscode.workspace.textDocuments.forEach(validate);

 context.subscriptions.push(
  vscode.workspace.onDidOpenTextDocument(validate),
  vscode.workspace.onDidChangeTextDocument(e => validate(e.document)),
  vscode.workspace.onDidCloseTextDocument(doc =>
   collection.delete(doc.uri)
  )
 );
}
