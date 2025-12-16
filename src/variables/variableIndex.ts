import * as vscode from 'vscode';

import { findConfPy } from '../project/projectResolver';
import { extractVariables } from '../parsing/rstParser';
import { RstVariable } from './variableTypes';
import { getProjectCache } from './cacheManager';

export async function indexVariables(
 rstFilePath: string
): Promise<Map<string, RstVariable>> {

 const result = new Map<string, RstVariable>();

 // 1. Переменные текущего файла (всегда актуальны)
 const doc = await vscode.workspace.openTextDocument(rstFilePath);
 extractVariables(doc.getText(), rstFilePath)
  .forEach((v, k) => result.set(k, v));

 // 2. Проектные переменные (через кэш)
 const conf = findConfPy(rstFilePath);
 if (!conf) return result;

 const cache = await getProjectCache(conf);
 const cacheVars = await cache.getVariables();
 cacheVars.forEach((v, k) => {
  if (!result.has(k)) result.set(k, v);
 });

 return result;
}
