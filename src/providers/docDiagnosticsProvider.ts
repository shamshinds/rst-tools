import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { findConfPy } from '../project/projectResolver';
import { parseIntersphinxMapping } from '../doc/docResolver';
import { discoverProjects } from '../doc/projectRegistry';
import { getEffectiveFilePath } from '../utils/contextResolver';
import { resolveWorkspaceRoot } from '../utils/workspaceResolver';
import { DOC_LINK_RE, normalizeDocTarget } from '../doc/docUtils';

const ADD_INTERSPHINX_CMD = 'rstTools.addIntersphinxProject';

export function registerDocDiagnosticsProvider(context: vscode.ExtensionContext) {
 const collection = vscode.languages.createDiagnosticCollection('rst-doc');
 context.subscriptions.push(collection);

 function validate(doc: vscode.TextDocument) {
  if (doc.languageId !== 'restructuredtext') return;

  const effectivePath = getEffectiveFilePath(doc);
  const workspaceRoot = resolveWorkspaceRoot(effectivePath, doc);
  if (!workspaceRoot) return;

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
    const confPy = findConfPy(effectivePath);
    if (!confPy) continue;

    const allowed = parseIntersphinxMapping(confPy);
    if (!allowed.has(projectId)) {
     diagnostics.push(new vscode.Diagnostic(
      range,
      `❌ Проект "${projectId}" не подключен в intersphinx_mapping`,
      vscode.DiagnosticSeverity.Error
     ));
     continue;
    }

    const project = discoverProjects(workspaceRoot).find(p => p.id === projectId);
    if (!project) continue;

    const target = path.resolve(project.root, relPath);
    if (!fs.existsSync(target)) {
     diagnostics.push(new vscode.Diagnostic(
      range,
      `❌ Файл не найден: ${projectId}:${relPath}`,
      vscode.DiagnosticSeverity.Error
     ));
    }
    continue;
   }

   const localTarget = path.resolve(path.dirname(effectivePath), normalized);
   if (!fs.existsSync(localTarget)) {
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

 registerCodeActionProvider(context);
 registerAddIntersphinxCommand(context);
}

function registerCodeActionProvider(context: vscode.ExtensionContext) {
 const provider = vscode.languages.registerCodeActionsProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   provideCodeActions(_doc, _range, ctx) {
    return ctx.diagnostics
     .map(diag => {
      const match = /Проект "([^"]+)"/.exec(diag.message);
      if (!match) return null;

      const projectId = match[1];
      const action = new vscode.CodeAction(
       `Добавить "${projectId}" в intersphinx_mapping`,
       vscode.CodeActionKind.QuickFix
      );
      action.command = {
       command: ADD_INTERSPHINX_CMD,
       title: 'Add intersphinx project',
       arguments: [_doc.fileName, projectId]
      };
      return action;
     })
     .filter((a): a is vscode.CodeAction => a !== null);
   }
  }
 );

 context.subscriptions.push(provider);
}

function registerAddIntersphinxCommand(context: vscode.ExtensionContext) {
 const cmd = vscode.commands.registerCommand(
  ADD_INTERSPHINX_CMD,
  async (filePath: string, projectId: string) => {
   const { resolveWorkspaceRootFromFile } = await import('../utils/workspaceResolver.js');
   const workspaceRoot = resolveWorkspaceRootFromFile(filePath);

   if (!workspaceRoot) {
    vscode.window.showErrorMessage('Не удалось определить корень проекта');
    return;
   }

   const parts = projectId.split('__');
   if (parts.length !== 2) {
    vscode.window.showErrorMessage(`Неверный формат проекта: ${projectId}`);
    return;
   }

   const [name, sub] = parts;
   const projectDir = path.join(workspaceRoot, 'source', 'ru', 'ru', name, sub);

   if (!fs.existsSync(projectDir)) {
    vscode.window.showErrorMessage(`Каталог проекта не найден: ${projectDir}`);
    return;
   }

   const confPy = findConfPy(filePath);
   if (!confPy) {
    vscode.window.showErrorMessage('conf.py не найден');
    return;
   }

   const doc = await vscode.workspace.openTextDocument(confPy);
   const text = doc.getText();

   const match = /intersphinx_mapping\s*=\s*generate_intersphinx_mapping\([^\[]*\[([\s\S]*?)\]\)/m.exec(text);
   if (!match) {
    vscode.window.showErrorMessage('Не удалось найти intersphinx_mapping');
    return;
   }

   if (match[1].includes(projectId)) {
    vscode.window.showInformationMessage('Проект уже добавлен');
    return;
   }

   const listContent = match[1];
   const listStartOffset = match.index + match[0].indexOf(listContent);
   const lastQuoteIndex = listContent.lastIndexOf("'");
   const insertPos = lastQuoteIndex !== -1
    ? listStartOffset + lastQuoteIndex + 1
    : match.index + match[0].lastIndexOf('[') + 1;

   const edit = new vscode.WorkspaceEdit();
   const position = doc.positionAt(insertPos);
   edit.insert(doc.uri, position, `, '${projectId}'`);
   await vscode.workspace.applyEdit(edit);

   const editor = await vscode.window.showTextDocument(doc, { preview: false });
   const pos = doc.positionAt(insertPos);
   editor.selection = new vscode.Selection(pos, pos);
   editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
   await doc.save();

   vscode.window.showInformationMessage(`Проект "${projectId}" добавлен`);
  }
 );

 context.subscriptions.push(cmd);
}
