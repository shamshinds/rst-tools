import * as vscode from 'vscode';
import { ProjectCache } from './projectCache';

const caches = new Map<string, ProjectCache>();

export async function getProjectCache(confPath: string): Promise<ProjectCache> {
 let cache = caches.get(confPath);

 if (!cache) {
  cache = new ProjectCache(confPath);
  await cache.build();
  caches.set(confPath, cache);
 }

 return cache;
}

// 1. Реакция на сохранение conf.py
vscode.workspace.onDidSaveTextDocument(doc => {
 if (doc.fileName.endsWith('conf.py')) {
  const cache = caches.get(doc.fileName);
  if (cache) {
   console.log('[RST] conf.py saved → reset cache');
   cache.dispose();
   caches.delete(doc.fileName);
  }
 }
});

// 2. Реакция на сохранение .rsti
vscode.workspace.onDidSaveTextDocument(doc => {
 if (!doc.fileName.endsWith('.rsti')) return;

 for (const [confPath, cache] of caches) {
  // простой и надёжный вариант: пересобираем кэш проекта
  console.log('[RST] rsti saved → rebuild cache', doc.fileName);
  cache.build();
 }
});
