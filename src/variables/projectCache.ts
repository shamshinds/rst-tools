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
 private pendingResolve?: () => void;
 private buildPromise: Promise<void> = Promise.resolve();

 constructor(private confPath: string) { }

 build(): Promise<void> {
  if (this.rebuildTimer) {
   clearTimeout(this.rebuildTimer);
  }

  // Каждый вызов build() возвращает Promise, который резолвится
  // только после фактического завершения построения кеша.
  // Без этого await cache.build() возвращался до окончания setTimeout,
  // и диагностика видела пустой кеш при первом открытии файла.
  this.buildPromise = new Promise<void>((resolve) => {
   this.pendingResolve = resolve;

   this.rebuildTimer = setTimeout(async () => {
    this.variables.clear();
    this.dispose();

    const includes = await parseIncludes(this.confPath);

    for (const file of includes) {
     if (!fs.existsSync(file)) continue;

     const text = this.readFile(file);

     extractVariables(text, file).forEach((v, name) => {
      v.source = path.normalize(v.source);

      if (v.kind === 'image' && v.imagePath) {
       v.imagePath = resolveRstPath(v.imagePath, file, this.confPath);
      }

      this.variables.set(name, v);
     });

     this.watch(file);
    }

    resolve();
   }, 100);
  });

  return this.buildPromise;
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
