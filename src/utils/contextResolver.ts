import * as vscode from 'vscode';
import { includeContext } from '../providers/includeSnippetHoverProvider';

export function resolveContext(file: string): string {
 let current = file;

 while (includeContext.has(current)) {
  const next = includeContext.get(current)!;
  if (next === current) break;
  current = next;
 }

 return current;
}

export function getEffectiveFilePath(doc: vscode.TextDocument): string {
 return resolveContext(doc.fileName);
}
