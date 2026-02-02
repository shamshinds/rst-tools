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

/* =========================================================
 * 1) Реакция на сохранение conf.py
 *    ВАЖНО: не удаляем кэш, а пересобираем его
 * ========================================================= */
vscode.workspace.onDidSaveTextDocument(async doc => {
 if (!doc.fileName.endsWith('conf.py')) return;

 const cache = caches.get(doc.fileName);
 if (cache) {
  console.log('[RST] conf.py saved → rebuild cache');
  await cache.build();
 } else {
  console.log('[RST] conf.py saved → no cache yet');
 }
});

/* =========================================================
 * 2) Реакция на сохранение .rsti
 *    Просто пересобираем ВСЕ активные кэши
 * ========================================================= */
vscode.workspace.onDidSaveTextDocument(async doc => {
 if (!doc.fileName.endsWith('.rsti')) return;

 for (const [confPath, cache] of caches) {
  console.log('[RST] rsti saved → rebuild cache', confPath, doc.fileName);
  await cache.build();
 }
});
