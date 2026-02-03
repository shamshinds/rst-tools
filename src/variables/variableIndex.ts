import * as vscode from 'vscode';
import * as path from 'path';

import { findConfPy } from '../project/projectResolver';
import { extractVariables } from '../parsing/rstParser';
import { RstVariable } from './variableTypes';
import { getProjectCache } from './cacheManager';
import { resolveRstPath } from '../utils/pathResolver';

function normalizeVarSource(v: RstVariable): RstVariable {
 return {
  ...v,
  source: path.normalize(v.source)
 };
}

function normalizeImagePath(
 v: RstVariable,
 ownerFile: string,
 confPath: string
): RstVariable {
 if (v.kind !== 'image' || !v.imagePath) return v;

 return {
  ...v,
  imagePath: resolveRstPath(v.imagePath, ownerFile, confPath)
 };
}

export async function indexVariables(
 rstFilePath: string
): Promise<Map<string, RstVariable>> {

 const result = new Map<string, RstVariable>();

 const conf = findConfPy(rstFilePath);

 // 1) Переменные текущего файла
 const doc = await vscode.workspace.openTextDocument(rstFilePath);

 extractVariables(doc.getText(), rstFilePath)
  .forEach((v, k) => {
   let vv = normalizeVarSource(v);

   // ✅ FIX: локальные image:: пути считаем относительно текущего файла
   if (conf) {
    vv = normalizeImagePath(vv, rstFilePath, conf);
   }

   result.set(k, vv);
  });

 // 2) Проектные переменные (через cache)
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
