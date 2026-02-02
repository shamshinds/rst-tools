// src/providers/docCompletionProvider.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { findConfPy } from '../project/projectResolver';
import { parseIntersphinxMapping } from '../doc/docResolver';
import { discoverProjects } from '../doc/projectRegistry';

/* ======================= helpers ======================= */

function stripRstExt(name: string): string {
 return name.toLowerCase().endsWith('.rst') ? name.slice(0, -4) : name;
}

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

/**
 * Находит диапазон пути внутри :doc:`...`
 * Поддерживает:
 *  - :doc:`path`
 *  - :doc:`text <path>`  (дополняем только часть path)
 */
function getDocPathRange(
 document: vscode.TextDocument,
 position: vscode.Position
): vscode.Range | null {
 const line = document.lineAt(position.line).text;
 const anchor = ':doc:`';

 const idx = line.lastIndexOf(anchor, position.character);
 if (idx === -1) return null;

 const start = idx + anchor.length;
 const raw = line.slice(start, position.character);

 const lt = raw.lastIndexOf('<');
 if (lt !== -1) {
  return new vscode.Range(
   new vscode.Position(position.line, start + lt + 1),
   position
  );
 }

 return new vscode.Range(
  new vscode.Position(position.line, start),
  position
 );
}

function getFsDirFromTyped(typed: string): string {
 if (!typed) return '.';
 if (typed.endsWith('/')) return typed;

 const idx = typed.lastIndexOf('/');
 if (idx === -1) return '.';

 return typed.slice(0, idx);
}

function getInsertBase(typed: string): string {
 if (!typed) return '';

 if (typed.endsWith('/')) return typed;

 const idx = typed.lastIndexOf('/');
 if (idx === -1) return '';

 return typed.slice(0, idx + 1);
}

/* ======================= provider ======================= */

export function registerDocCompletionProvider(
 context: vscode.ExtensionContext
) {
 const provider = vscode.languages.registerCompletionItemProvider(
  { language: 'restructuredtext', scheme: 'file' },
  {
   provideCompletionItems(doc, pos) {
    const range = getDocPathRange(doc, pos);
    if (!range) return;

    const typed = doc.getText(range);

    const confPy = findConfPy(doc.fileName);

    const workspaceRoot =
     getWorkspaceRoot(doc) ??
     resolveWorkspaceRootFromFile(doc.fileName);

    /* ------------------- PROJECT ID (EXTERNAL) ------------------- */
    // ✅ Показываем подключенные проекты даже до ввода ":"
    if (!typed.includes(':') && confPy) {
     const allowed = parseIntersphinxMapping(confPy);

     if (allowed.size > 0) {
      const items: vscode.CompletionItem[] = [];

      for (const id of [...allowed.values()].sort()) {
       const item = new vscode.CompletionItem(
        id,
        vscode.CompletionItemKind.Module
       );
       item.range = range;
       item.insertText = id + ':';
       item.filterText = typed;
       items.push(item);
      }

      // если пользователь реально начал вводить project-id
      if (/^[a-z0-9_-]+$/i.test(typed) || typed === '') {
       return items;
      }
     }
    }

    if (!workspaceRoot) return;

    /* ------------------- EXTERNAL PROJECT ------------------- */

    if (typed.includes(':')) {
     const [projectId, rest = ''] = typed.split(':', 2);

     if (!confPy) return;

     const allowed = parseIntersphinxMapping(confPy);
     const projects = discoverProjects(workspaceRoot);

     const project = projects.find(
      p => p.id === projectId && allowed.has(p.id)
     );
     if (!project) return;

     const fsDir = path.resolve(
      project.root,
      getFsDirFromTyped(rest)
     );
     if (!fs.existsSync(fsDir)) return;

     const insertBase = getInsertBase(rest);

     const items: vscode.CompletionItem[] = [];

     for (const entry of fs.readdirSync(fsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
       const item = new vscode.CompletionItem(
        entry.name + '/',
        vscode.CompletionItemKind.Folder
       );
       item.range = range;
       item.insertText =
        `${projectId}:${insertBase}${entry.name}/`;
       item.filterText = typed;
       item.command = {
        command: 'editor.action.triggerSuggest',
        title: 'Continue'
       };
       items.push(item);
      }

      if (entry.isFile() && entry.name.endsWith('.rst')) {
       const item = new vscode.CompletionItem(
        stripRstExt(entry.name),
        vscode.CompletionItemKind.File
       );
       item.range = range;

       // ✅ вставляем имя без расширения .rst
       item.insertText =
        `${projectId}:${insertBase}${stripRstExt(entry.name)}`;

       item.filterText = typed;
       items.push(item);
      }
     }

     return items;
    }

    /* ---------------------- LOCAL PROJECT ------------------- */

    const fsDir = path.resolve(
     path.dirname(doc.fileName),
     getFsDirFromTyped(typed)
    );
    if (!fs.existsSync(fsDir)) return;

    const insertBase = getInsertBase(typed);

    const items: vscode.CompletionItem[] = [];

    for (const entry of fs.readdirSync(fsDir, { withFileTypes: true })) {
     if (entry.isDirectory()) {
      const item = new vscode.CompletionItem(
       entry.name + '/',
       vscode.CompletionItemKind.Folder
      );
      item.range = range;
      item.insertText = insertBase + entry.name + '/';
      item.filterText = typed;
      item.command = {
       command: 'editor.action.triggerSuggest',
       title: 'Continue'
      };
      items.push(item);
     }

     if (entry.isFile() && entry.name.endsWith('.rst')) {
      const item = new vscode.CompletionItem(
       stripRstExt(entry.name),
       vscode.CompletionItemKind.File
      );
      item.range = range;

      // ✅ вставляем имя без расширения .rst
      item.insertText = insertBase + stripRstExt(entry.name);

      item.filterText = typed;
      items.push(item);
     }
    }

    return items;
   }
  },
  '/', '.', ':'
 );

 context.subscriptions.push(provider);
}
