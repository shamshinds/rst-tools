import * as vscode from 'vscode';
import * as path from 'path';

import { discoverProjects } from '../doc/projectRegistry';
import { parseDocsUrl, buildRelativeDocPath, wrapInDocRole } from '../doc/urlToDoc';
import { findConfPy } from '../project/projectResolver';
import { getEffectiveFilePath } from '../utils/contextResolver';
import { resolveWorkspaceRoot } from '../utils/workspaceResolver';
import { getDocsBaseUrls } from '../utils/settings';

export const CONVERT_URL_TO_DOC_CMD = 'rstTools.convertUrlToDoc';

// Границы URL: пробелы и символы, которыми URL обычно обрамляют в RST.
const URL_REGEX = /https?:\/\/[^\s<>`"'()[\]]+/;

/**
 * Диапазон с URL: выделение, если оно есть, иначе URL под курсором.
 */
function findUrlRange(editor: vscode.TextEditor): vscode.Range | null {
 const { document, selection } = editor;

 if (!selection.isEmpty) {
  return document.getText(selection).trim() ? selection : null;
 }

 return document.getWordRangeAtPosition(selection.active, URL_REGEX) ?? null;
}

/**
 * Идентификатор проекта, которому принадлежит открытый файл.
 * Нужен, чтобы ссылку внутри своего проекта записать относительным путем.
 */
function findCurrentProject(
 effectivePath: string,
 doc: vscode.TextDocument
): { id: string; root: string } | null {
 const workspaceRoot = resolveWorkspaceRoot(effectivePath, doc);
 const confPath = findConfPy(effectivePath);
 if (!workspaceRoot || !confPath) return null;

 const projectRoot = path.normalize(path.dirname(confPath));

 return discoverProjects(workspaceRoot)
  .find(p => path.normalize(p.root) === projectRoot) ?? null;
}

export function registerConvertUrlToDocCommand(context: vscode.ExtensionContext) {
 const cmd = vscode.commands.registerCommand(CONVERT_URL_TO_DOC_CMD, async () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
   vscode.window.showErrorMessage('Нет активного редактора');
   return;
  }

  const range = findUrlRange(editor);
  if (!range) {
   vscode.window.showWarningMessage(
    'Не найден URL: поставьте курсор на ссылку или выделите ее'
   );
   return;
  }

  const rawUrl = editor.document.getText(range).trim();
  const parts = parseDocsUrl(rawUrl, getDocsBaseUrls());

  if (!parts) {
   vscode.window.showWarningMessage(
    `Не удалось разобрать URL как ссылку на документацию: ${rawUrl}`
   );
   return;
  }

  const doc = editor.document;
  const effectivePath = getEffectiveFilePath(doc);
  const current = findCurrentProject(effectivePath, doc);

  let target: string;

  if (current && current.id === parts.projectId) {
   // Свой проект: префикс проекта здесь не работает, нужен путь от файла.
   target = buildRelativeDocPath(current.root, parts.docPath, effectivePath);
  } else {
   target = `${parts.projectId}:${parts.docPath}`;

   const workspaceRoot = resolveWorkspaceRoot(effectivePath, doc);
   const known = workspaceRoot
    ? discoverProjects(workspaceRoot).some(p => p.id === parts.projectId)
    : false;

   if (!known) {
    vscode.window.showWarningMessage(
     `Проект "${parts.projectId}" не найден локально — ссылка вставлена, но не проверена`
    );
   }
  }

  const applied = await editor.edit(edit => edit.replace(range, wrapInDocRole(target)));
  if (!applied) {
   vscode.window.showErrorMessage('Не удалось заменить URL');
  }
 });

 context.subscriptions.push(cmd);
}
