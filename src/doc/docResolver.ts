// src/doc/docResolver.ts

import * as fs from 'fs';
import * as vscode from 'vscode';

/**
 * Кэш intersphinx_mapping по conf.py
 * key   — абсолютный путь к conf.py
 * value — Set с projectId
 */
const intersphinxCache = new Map<string, Set<string>>();

console.log('[RST DOC] docResolver loaded');

export function parseIntersphinxMapping(confPath: string): Set<string> {
 // ✅ если есть в кэше — возвращаем
 const cached = intersphinxCache.get(confPath);
 if (cached) {
  return cached;
 }

 let text: string;
 try {
  text = fs.readFileSync(confPath, 'utf-8');
 } catch {
  const empty = new Set<string>();
  intersphinxCache.set(confPath, empty);
  return empty;
 }

 const regex =
  /generate_intersphinx_mapping\s*\([^,]+,\s*\[([^\]]*)\]/m;

 const match = regex.exec(text);
 if (!match) {
  const empty = new Set<string>();
  intersphinxCache.set(confPath, empty);
  return empty;
 }

 const projects = new Set(
  match[1]
   .split(',')
   .map(s => s.replace(/['"]/g, '').trim())
   .filter(Boolean)
 );

 intersphinxCache.set(confPath, projects);
 return projects;
}

/**
 * Явная инвалидация кэша для conf.py
 */
export function invalidateIntersphinxMapping(confPath: string) {
 intersphinxCache.delete(confPath);
}

/* =========================================================
 * Автоматическая инвалидация при сохранении conf.py
 * ========================================================= */

vscode.workspace.onDidSaveTextDocument(doc => {
 if (doc.fileName.endsWith('conf.py')) {
  console.log('[RST DOC] invalidate intersphinx cache:', doc.fileName);
  intersphinxCache.delete(doc.fileName);
 }
});
