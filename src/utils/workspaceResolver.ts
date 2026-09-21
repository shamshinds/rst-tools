import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getProjectsRootSegmentsList } from './settings';

export function resolveWorkspaceRootFromFile(filePath: string): string | null {
 let dir = path.dirname(filePath);
 const rootSegmentsList = getProjectsRootSegmentsList();

 while (true) {
  if (rootSegmentsList.some(segments => fs.existsSync(path.join(dir, ...segments)))) {
   return dir;
  }

  const parent = path.dirname(dir);
  if (parent === dir) break;
  dir = parent;
 }

 return null;
}

function getWorkspaceRoot(doc: vscode.TextDocument): string | null {
 const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
 return folder ? folder.uri.fsPath : null;
}

export function resolveWorkspaceRoot(
 filePath: string,
 doc: vscode.TextDocument
): string | null {
 return resolveWorkspaceRootFromFile(filePath) ?? getWorkspaceRoot(doc);
}
