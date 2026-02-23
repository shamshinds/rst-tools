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
  if (fs.existsSync(candidate)) return dir;

  const parent = path.dirname(dir);
  if (parent === dir) break;
  dir = parent;
 }

 return null;
}

/**
 * Возвращает возможные пути для :doc:
 */
function buildDocCandidates(raw: string): string[] {
 let p = raw.trim();

 // :doc:`text <path>`
 const lt = p.lastIndexOf('<');
 const gt = p.lastIndexOf('>');
 if (lt !== -1 && gt !== -1 && gt > lt) {
  p = p.slice(lt + 1, gt).trim();
 }

 const candidates = new Set<string>();

 if (p.endsWith('/')) {
  candidates.add(path.join(p, 'index.rst'));
 } else {
  candidates.add(p + '.rst');
  candidates.add(path.join(p, 'index.rst'));
 }

 return [...candidates];
}

/**
 * Нормализует содержимое :doc:`...`
 *
 * :doc:`text <path>` → path
 * :doc:`path` → path
 * добавляет .rst если расширения нет
 */
function normalizeDocTarget(raw: string): string {
 let p = raw.trim();

 // :doc:`text <path>`
 const lt = p.lastIndexOf('<');
 const gt = p.lastIndexOf('>');
 if (lt !== -1 && gt !== -1 && gt > lt) {
  p = p.slice(lt + 1, gt).trim();
 }

 // убираем якорь (на будущее)
 const hash = p.indexOf('#');
 if (hash !== -1) {
  p = p.slice(0, hash);
 }

 if (!p.endsWith('.rst')) {
  p += '.rst';
 }

 return p;
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
   const rawInside = match[1];

   const start = doc.positionAt(match.index + 6);
   const end = doc.positionAt(match.index + 6 + rawInside.length);
   const range = new vscode.Range(start, end);

   const normalized = normalizeDocTarget(rawInside);
   if (!normalized) continue;

   // =========================================================
   // EXTERNAL PROJECT DOC
   // =========================================================
   if (normalized.includes(':')) {
    const [projectId, relPath] = normalized.split(':', 2);

    const confPy = findConfPy(doc.fileName);
    if (!confPy) continue;

    const allowed = parseIntersphinxMapping(confPy);

    if (!allowed.has(projectId)) {
     diagnostics.push(
      new vscode.Diagnostic(
       range,
       `❌ Проект "${projectId}" не подключен через intersphinx_mapping`,
       vscode.DiagnosticSeverity.Error
      )
     );
     continue;
    }

    const workspaceRoot =
     getWorkspaceRoot(doc) ??
     resolveWorkspaceRootFromFile(doc.fileName);
    if (!workspaceRoot) continue;

    const projects = discoverProjects(workspaceRoot);

    const project = projects.find(p => p.id === projectId);
    if (!project) {
     diagnostics.push(
      new vscode.Diagnostic(
       range,
       `❌ Проект "${projectId}" не найден в workspace`,
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
       `❌ Файл не найден: ${projectId}:${relPath}`,
       vscode.DiagnosticSeverity.Error
      )
     );
    }

    // ⛔ ВАЖНО: НЕ ПРОВЕРЯЕМ КАК LOCAL
    continue;
   }

   // =========================================================
   // LOCAL DOC
   // =========================================================
   const localTarget = path.resolve(
    path.dirname(doc.fileName),
    normalized
   );

   if (!fs.existsSync(localTarget)) {
    diagnostics.push(
     new vscode.Diagnostic(
      range,
      `❌ Файл не найден: ${normalized}`,
      vscode.DiagnosticSeverity.Error
     )
    );
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
  vscode.workspace.onDidCloseTextDocument(doc =>
   collection.delete(doc.uri)
  ),
  vscode.window.onDidChangeActiveTextEditor(() =>
   validateActiveEditor()
  )
 );

 setTimeout(() => validateActiveEditor(), 300);
}
