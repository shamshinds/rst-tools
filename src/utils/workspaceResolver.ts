import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export function resolveWorkspaceRootFromFile(filePath: string): string | null {
 let dir = path.dirname(filePath);

 while (true) {
  const candidate = path.join(dir, 'source', 'ru', 'ru');
  if (fs.existsSync(candidate)) return dir;

  const parent = path.dirname(dir);
  if (parent === dir) break;
  dir = parent;
 }

 return null;
}

export function getWorkspaceRoot(doc: vscode.TextDocument): string | null {
 const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
 return folder ? folder.uri.fsPath : null;
}

export function resolveWorkspaceRoot(
 filePath: string,
 doc: vscode.TextDocument
): string | null {
 return resolveWorkspaceRootFromFile(filePath) ?? getWorkspaceRoot(doc);
}
