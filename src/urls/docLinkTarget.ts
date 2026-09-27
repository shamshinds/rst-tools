import * as vscode from 'vscode';
import * as path from 'path';

import { discoverProjects } from '../doc/projectRegistry';
import { DocUrlParts, buildRelativeDocPath } from '../doc/urlToDoc';
import { resolveWorkspaceRoot } from '../utils/workspaceResolver';

/** Границы URL: пробелы и символы, которыми URL обычно обрамляют в RST. */
export const URL_REGEX = /https?:\/\/[^\s<>`"'()[\]]+/;

export interface DocTargetResult {
 /** Готовая цель для роли: путь от файла либо `проект__раздел:путь`. */
 target: string;
 /** Сообщение, которое стоит показать автору, если цель не проверена. */
 warning?: string;
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

/**
 * Превращает разобранный URL в цель роли `:doc:`.
 *
 * Ссылка на свой же раздел записывается относительным путем: префикс
 * проекта для своего проекта в Sphinx не работает.
 */
export function resolveDocTarget(
 parts: DocUrlParts,
 effectivePath: string,
 doc: vscode.TextDocument
): DocTargetResult {
 const current = findCurrentProject(effectivePath, doc);

 if (current && current.id === parts.projectId) {
  return {
   target: buildRelativeDocPath(current.root, parts.docPath, effectivePath)
  };
 }

 const target = `${parts.projectId}:${parts.docPath}`;
 const workspaceRoot = resolveWorkspaceRoot(effectivePath, doc);
 const known = workspaceRoot
  ? discoverProjects(workspaceRoot).some(p => p.id === parts.projectId)
  : false;

 return known
  ? { target }
  : {
   target,
   warning: `Проект "${parts.projectId}" не найден локально — ссылка вставлена, но не проверена`
  };
}
