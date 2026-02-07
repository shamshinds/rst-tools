// src/providers/docDefinitionProvider.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { findConfPy } from '../project/projectResolver';
import { parseIntersphinxMapping } from '../doc/docResolver';
import { discoverProjects } from '../doc/projectRegistry';

/**
 * :doc:`...`
 */
const DOC_LINK_RE = /:doc:`([^`]+)`/g;

function resolveWorkspaceRootFromFile(filePath: string): string | null {
 let dir = path.dirname(filePath);

 while (true) {
  const candidate = path.join(dir, 'source', 'ru', 'ru');
  if (fs.existsSync(candidate)) {
   return dir;
  }

  const parent = path.dirname(dir);
  if (parent === dir) {
   break;
  }
  dir = parent;
 }

 return null;
}

export function registerDocDefinitionProvider(
 context: vscode.ExtensionContext
) {
 const provider = vscode.languages.registerDefinitionProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   provideDefinition(doc, pos) {
    const text = doc.getText();
    let match: RegExpExecArray | null;

    while ((match = DOC_LINK_RE.exec(text)) !== null) {
     const raw = match[1];

     const linkStart = match.index + 6; // длина ':doc:`'
     const linkEnd = linkStart + raw.length;

     const range = new vscode.Range(
      doc.positionAt(linkStart),
      doc.positionAt(linkEnd)
     );

     // курсор должен быть внутри ссылки
     if (!range.contains(pos)) {
      continue;
     }

     const workspaceRoot =
      vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath ??
      resolveWorkspaceRootFromFile(doc.fileName);

     if (!workspaceRoot) {
      return null;
     }

     /* ------------------ межпроектная ссылка ------------------ */

     if (raw.includes(':')) {
      const [projectId, rel] = raw.split(':', 2);

      const conf = findConfPy(doc.fileName);
      if (!conf) {
       return null;
      }

      const allowed = parseIntersphinxMapping(conf);
      const projects = discoverProjects(workspaceRoot);

      const project = projects.find(
       p => p.id === projectId && allowed.has(p.id)
      );

      if (!project) {
       return null;
      }

      const target = path.join(
       project.root,
       rel.endsWith('.rst') ? rel : `${rel}.rst`
      );

      if (!fs.existsSync(target)) {
       return null;
      }

      return new vscode.Location(
       vscode.Uri.file(target),
       new vscode.Position(0, 0)
      );
     }

     /* -------------------- локальная ссылка ------------------- */

     const baseDir = path.dirname(doc.fileName);
     const target = path.join(
      baseDir,
      raw.endsWith('.rst') ? raw : `${raw}.rst`
     );

     if (!fs.existsSync(target)) {
      return null;
     }

     return new vscode.Location(
      vscode.Uri.file(target),
      new vscode.Position(0, 0)
     );
    }

    return null;
   }
  }
 );

 context.subscriptions.push(provider);
}
