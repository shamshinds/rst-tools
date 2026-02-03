import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { parseIncludes } from '../parsing/confParser';
import { extractVariables } from '../parsing/rstParser';
import { RstVariable } from '../variables/variableTypes';
import { resolveRstPath } from '../utils/pathResolver';

export class ProjectCache {
 private variables = new Map<string, RstVariable>();
 private watchers: vscode.FileSystemWatcher[] = [];
 private rebuildTimer?: NodeJS.Timeout;

 constructor(private confPath: string) { }

 async build() {
  if (this.rebuildTimer) {
   clearTimeout(this.rebuildTimer);
  }

  this.rebuildTimer = setTimeout(async () => {
   this.variables.clear();
   this.dispose();

   const includes = await parseIncludes(this.confPath);

   for (const file of includes) {
    if (!fs.existsSync(file)) continue;

    const text = this.readFile(file);

    extractVariables(text, file).forEach((v, name) => {
     // всегда нормализуем source
     v.source = path.normalize(v.source);

     // ✅ FIX: imagePath может быть:
     // - "/../../..." (от conf.py)
     // - "./..." или "../..." (от текущего rsti файла)
     if (v.kind === 'image' && v.imagePath) {
      v.imagePath = resolveRstPath(v.imagePath, file, this.confPath);
     }

     this.variables.set(name, v);
    });

    this.watch(file);
   }
  }, 100);
 }

 getVariables() {
  return this.variables;
 }

 private readFile(file: string): string {
  const doc = vscode.workspace.textDocuments.find(d => d.fileName === file);
  return doc ? doc.getText() : fs.readFileSync(file, 'utf-8');
 }

 private watch(file: string) {
  const watcher = vscode.workspace.createFileSystemWatcher(file);
  watcher.onDidChange(() => this.build());
  watcher.onDidDelete(() => this.build());
  this.watchers.push(watcher);
 }

 dispose() {
  this.watchers.forEach(w => w.dispose());
  this.watchers = [];
 }
}
