import * as vscode from 'vscode';
import * as path from 'path';

import { findConfPy } from '../project/projectResolver';
import { extractVariables } from '../parsing/rstParser';
import { RstVariable } from './variableTypes';
import { getProjectCache } from './cacheManager';

function normalizeVarSource(v: RstVariable): RstVariable {
 return {
  ...v,
  source: path.normalize(v.source)
 };
}

export async function indexVariables(
 rstFilePath: string
): Promise<Map<string, RstVariable>> {

 const result = new Map<string, RstVariable>();

 // 1) Переменные текущего файла
 const doc = await vscode.workspace.openTextDocument(rstFilePath);

 extractVariables(doc.getText(), rstFilePath)
  .forEach((v, k) => {
   result.set(k, normalizeVarSource(v));
  });

 // 2) Проектные переменные (через cache)
 const conf = findConfPy(rstFilePath);
 if (!conf) return result;

 const cache = await getProjectCache(conf);
 const cacheVars = await cache.getVariables();

 cacheVars.forEach((v, k) => {
  if (!result.has(k)) {
   result.set(k, normalizeVarSource(v));
  }
 });

 return result;
}
