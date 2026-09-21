import * as vscode from 'vscode';
import * as path from 'path';

import { discoverProjects } from '../doc/projectRegistry';
import { parseDocsUrl, buildRelativeDocPath, wrapInDocRole } from '../doc/urlToDoc';
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

/** Лежит ли файл внутри каталога. */
function isInside(filePath: string, dir: string): boolean {
 const relative = path.relative(dir, filePath);
 return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Раздел документации, которому принадлежит открытый файл.
 * Нужен, чтобы ссылку внутри своего раздела записать относительным путем.
 *
 * Ищем по вхождению пути, а не по conf.py: у раздела, опознанного
 * по наличию .rst, собственного conf.py может не быть.
 */
function findCurrentProject(
 effectivePath: string,
 doc: vscode.TextDocument
): { id: string; root: string } | null {
 const workspaceRoot = resolveWorkspaceRoot(effectivePath, doc);
 if (!workspaceRoot) return null;

 const filePath = path.normalize(effectivePath);

 // Самый глубокий подходящий раздел — на случай вложенных корней.
 return discoverProjects(workspaceRoot)
  .filter(p => isInside(filePath, path.normalize(p.root)))
  .sort((a, b) => b.root.length - a.root.length)[0] ?? null;
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
