// src/providers/docCompletionProvider.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { findConfPy } from '../project/projectResolver';
import { parseIntersphinxMapping } from '../doc/docResolver';
import { discoverProjects } from '../doc/projectRegistry';

/* ======================= helpers ======================= */

function getDocPathRange(
 document: vscode.TextDocument,
 position: vscode.Position
): vscode.Range | null {
 const line = document.lineAt(position.line).text;
 const anchor = ':doc:`';

 const idx = line.lastIndexOf(anchor, position.character);
 if (idx === -1) return null;

 return new vscode.Range(
  new vscode.Position(position.line, idx + anchor.length),
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

    const workspaceRoot =
     getWorkspaceRoot(doc) ??
     resolveWorkspaceRootFromFile(doc.fileName);
    if (!workspaceRoot) return;
  
    /* ------------------- EXTERNAL PROJECT ------------------- */

    if (typed.includes(':')) {
     const [projectId, rest = ''] = typed.split(':', 2);

     const confPy = findConfPy(doc.fileName);
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

     const base =
      rest.endsWith('/') || rest === ''
       ? rest
       : rest + '/';

     const items: vscode.CompletionItem[] = [];

     for (const entry of fs.readdirSync(fsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
       const item = new vscode.CompletionItem(
        entry.name + '/',
        vscode.CompletionItemKind.Folder
       );
       item.range = range;
       item.insertText =
        `${projectId}:${base}${entry.name}/`;
       item.filterText = typed;
       item.command = {
        command: 'editor.action.triggerSuggest',
        title: 'Continue'
       };
       items.push(item);
      }

      if (entry.isFile() && entry.name.endsWith('.rst')) {
       const item = new vscode.CompletionItem(
        entry.name,
        vscode.CompletionItemKind.File
       );
       item.range = range;
       item.insertText =
        `${projectId}:${base}${entry.name}`;
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

    const base =
     typed.endsWith('/') || typed === ''
      ? typed
      : typed + '/';

    const items: vscode.CompletionItem[] = [];

    for (const entry of fs.readdirSync(fsDir, { withFileTypes: true })) {
     if (entry.isDirectory()) {
      const item = new vscode.CompletionItem(
       entry.name + '/',
       vscode.CompletionItemKind.Folder
      );
      item.range = range;
      item.insertText = base + entry.name + '/';
      item.filterText = typed;
      item.command = {
       command: 'editor.action.triggerSuggest',
       title: 'Continue'
      };
      items.push(item);
     }

     if (entry.isFile() && entry.name.endsWith('.rst')) {
      const item = new vscode.CompletionItem(
       entry.name,
       vscode.CompletionItemKind.File
      );
      item.range = range;
      item.insertText = base + entry.name;
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
