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


/**
 * :doc:`text <path>` → path
 * :doc:`path` → path
 * + добавляет .rst если нужно
 */
function normalizeDocTarget(raw: string): string {
 let p = raw.trim();

 const lt = p.lastIndexOf('<');
 const gt = p.lastIndexOf('>');
 if (lt !== -1 && gt !== -1 && gt > lt) {
  p = p.slice(lt + 1, gt).trim();
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

  const workspaceRoot = getWorkspaceRoot(doc);
  if (!workspaceRoot) return;

  const projects = discoverProjects(workspaceRoot);

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

   /* -------------------- EXTERNAL PROJECT -------------------- */

   if (normalized.includes(':')) {
    const [projectId, relPath] = normalized.split(':', 2);

    const confPy = findConfPy(doc.fileName);
    if (!confPy) continue;

    const allowed = parseIntersphinxMapping(confPy);

    console.log('\n[RST DOC] ===== DOC LINK CHECK =====');
    console.log('[RST DOC] raw inside =', rawInside);
    console.log('[RST DOC] normalized =', normalized);
    console.log('[RST DOC] projectId =', projectId);
    console.log('[RST DOC] relPath =', relPath);
    console.log('[RST DOC] conf.py =', confPy);
    console.log(
     '[RST DOC] allowed intersphinx projects =',
     Array.from(allowed)
    );

    // поднимаемся от conf.py до корня workspace
    let workspaceRoot = path.dirname(confPy);

    while (true) {
     const candidate = path.join(workspaceRoot, 'source', 'ru', 'ru');
     if (fs.existsSync(candidate)) {
      break;
     }

     const parent = path.dirname(workspaceRoot);
     if (parent === workspaceRoot) {
      console.log('[RST DOC] ❌ workspace root not found');
      return;
     }

     workspaceRoot = parent;
    }

    console.log('[RST DOC] FIXED workspaceRoot =', workspaceRoot);

    const projects = discoverProjects(workspaceRoot);

    console.log('[RST DOC] projectsRoot =', workspaceRoot);
    console.log(
     '[RST DOC] discovered projects =',
     projects.map(p => ({
      id: p.id,
      root: p.root
     }))
    );


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

    for (const p of projects) {
     console.log(
      `[RST DOC] compare "${projectId}" === "${p.id}" →`,
      projectId === p.id
     );
    }

    const project = projects.find(p => p.id === projectId);
    if (!project) {
     diagnostics.push(
      new vscode.Diagnostic(
       range,
       `❌ Проект "${projectId}" не найден в source/ru/ru`,
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

    continue;
   }

   /* ---------------------- LOCAL PROJECT ---------------------- */

   const target = path.resolve(
    path.dirname(doc.fileName),
    normalized
   );

   if (!fs.existsSync(target)) {
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

 // первичная валидация
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

 // повторная проверка после старта
 setTimeout(() => validateActiveEditor(), 300);
}
