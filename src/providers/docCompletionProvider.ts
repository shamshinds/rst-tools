import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { findConfPy } from '../project/projectResolver';
import { parseIntersphinxMapping } from '../doc/docResolver';
import { discoverProjects } from '../doc/projectRegistry';
import { getEffectiveFilePath } from '../utils/contextResolver';
import { resolveWorkspaceRoot } from '../utils/workspaceResolver';

function stripRstExt(name: string): string {
 if (name.endsWith('.rsti')) return name.slice(0, -5);
 if (name.endsWith('.rst')) return name.slice(0, -4);
 return name;
}

function getQuerySegment(typed: string): string {
 if (!typed || typed.endsWith('/')) return '';
 const idx = typed.lastIndexOf('/');
 return idx === -1 ? typed : typed.slice(idx + 1);
}

function normalizeQuery(q: string): string {
 return q.replace(/^(\.\.\/)+/, '').toLowerCase();
}

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

 return new vscode.Range(new vscode.Position(position.line, start), position);
}

function getFsDirFromTyped(typed: string): string {
 if (!typed) return '.';
 const idx = typed.lastIndexOf('/');
 return idx === -1 ? '.' : typed.slice(0, idx + 1);
}

function getInsertBase(typed: string): string {
 if (!typed || !typed.includes('/')) return '';
 if (typed.endsWith('/')) return typed;
 return typed.slice(0, typed.lastIndexOf('/') + 1);
}

export function registerDocCompletionProvider(context: vscode.ExtensionContext) {
 const provider = vscode.languages.registerCompletionItemProvider(
  { language: 'restructuredtext', scheme: 'file' },
  {
   provideCompletionItems(doc, pos) {
    const range = getDocPathRange(doc, pos);
    if (!range) return;

    const typed = doc.getText(range);
    const effectivePath = getEffectiveFilePath(doc);
    const rawQuery = getQuerySegment(typed);
    const query = normalizeQuery(rawQuery);
    const confPy = findConfPy(effectivePath);
    const workspaceRoot = resolveWorkspaceRoot(effectivePath, doc);
    if (!workspaceRoot) return;

    /* ------------------- PROJECT ID ------------------- */

    if (!typed.includes(':') && confPy && !typed.includes('/') && !typed.includes('.')) {
     const allowed = parseIntersphinxMapping(confPy);
     const items: vscode.CompletionItem[] = [];

     for (const id of [...allowed.values()].sort()) {
      if (typed && !id.toLowerCase().startsWith(typed.toLowerCase())) continue;

      const item = new vscode.CompletionItem(id, vscode.CompletionItemKind.Module);
      item.range = range;
      item.insertText = id + ':';
      item.filterText = id;
      item.command = { command: 'editor.action.triggerSuggest', title: 'Trigger Suggest' };
      items.push(item);
     }

     if (/^[a-z0-9_-]*$/i.test(typed)) {
      return new vscode.CompletionList(items, true);
     }
    }

    /* ------------------- EXTERNAL ------------------- */

    if (typed.includes(':')) {
     const [projectId, rest = ''] = typed.split(':', 2);
     if (!confPy) return;

     const allowed = parseIntersphinxMapping(confPy);
     const project = discoverProjects(workspaceRoot).find(
      p => p.id === projectId && allowed.has(p.id)
     );
     if (!project) return;

     const fsDir = path.resolve(project.root, getFsDirFromTyped(rest));
     if (!fs.existsSync(fsDir)) return [];

     const insertBase = getInsertBase(rest);
     const localQuery = normalizeQuery(getQuerySegment(rest));
     const items: vscode.CompletionItem[] = [];

     for (const entry of fs.readdirSync(fsDir, { withFileTypes: true })) {
      const name = entry.name;
      const base = stripRstExt(name);

      if (localQuery && !base.toLowerCase().startsWith(localQuery)) continue;

      if (entry.isDirectory()) {
       const item = new vscode.CompletionItem(name + '/', vscode.CompletionItemKind.Folder);
       item.range = range;
       item.insertText = `${projectId}:${insertBase}${name}/`;
       item.filterText = typed;
       item.command = { command: 'editor.action.triggerSuggest', title: 'Continue' };
       items.push(item);
      }

      if (entry.isFile() && (name.endsWith('.rst') || name.endsWith('.rsti'))) {
       const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.File);
       item.range = range;
       item.insertText = `${projectId}:${insertBase}${stripRstExt(name)}`;
       item.filterText = typed;
       items.push(item);
      }
     }

     return new vscode.CompletionList(items, true);
    }

    /* ------------------- LOCAL ------------------- */

    const baseDir = path.dirname(doc.fileName);
    const fsDir = path.resolve(baseDir, getFsDirFromTyped(typed));
    if (!fs.existsSync(fsDir)) return [];

    const insertBase = getInsertBase(typed);
    const items: vscode.CompletionItem[] = [];

    for (const entry of fs.readdirSync(fsDir, { withFileTypes: true })) {
     const name = entry.name;
     const base = stripRstExt(name);

     if (query && !base.toLowerCase().includes(query)) continue;

     if (entry.isDirectory()) {
      const item = new vscode.CompletionItem(name + '/', vscode.CompletionItemKind.Folder);
      item.range = range;
      item.insertText = insertBase + name + '/';
      item.filterText = typed;
      item.command = { command: 'editor.action.triggerSuggest', title: 'Continue' };
      items.push(item);
     }

     if (entry.isFile() && name.endsWith('.rst')) {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.File);
      item.range = range;
      item.insertText = insertBase + base;
      item.filterText = typed;
      items.push(item);
     }
    }

    return new vscode.CompletionList(items, false);
   }
  },
  '/', '.', ':'
 );

 context.subscriptions.push(provider);
}
