import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { findConfPy } from '../project/projectResolver';
import { parseIntersphinxMapping } from '../doc/docResolver';
import { discoverProjects } from '../doc/projectRegistry';

const DOC_RE = /:doc:`([^`]+)`/g;

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

function extractDocTarget(raw: string): string {
 const lt = raw.lastIndexOf('<');
 const gt = raw.lastIndexOf('>');

 if (lt !== -1 && gt !== -1 && gt > lt) {
  return raw.slice(lt + 1, gt).trim();
 }

 return raw.trim();
}



export function registerDocLinkProvider(
 context: vscode.ExtensionContext
) {
 const provider = vscode.languages.registerDocumentLinkProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   provideDocumentLinks(doc) {
    const links: vscode.DocumentLink[] = [];
    const text = doc.getText();

    const workspaceRoot =
     vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath ??
     resolveWorkspaceRootFromFile(doc.fileName);

    if (!workspaceRoot) {
     return links;
    }

    let m: RegExpExecArray | null;

    while ((m = DOC_RE.exec(text)) !== null) {
     const raw = extractDocTarget(m[1]);

     const fullMatch = m[0]; // :doc:`...`

     const start = doc.positionAt(m.index + ':doc:`'.length);
     const end = doc.positionAt(m.index + fullMatch.length - 1); // перед `
     const range = new vscode.Range(start, end);

     let target: string | null = null;

     /* -------- межпроектная ссылка -------- */

     if (raw.includes(':')) {
      const [projectId, rel] = raw.split(':', 2);

      const conf = findConfPy(doc.fileName);
      if (!conf) {
       continue;
      }

      const allowed = parseIntersphinxMapping(conf);
      const projects = discoverProjects(workspaceRoot);

      const project = projects.find(
       p => p.id === projectId && allowed.has(p.id)
      );

      if (!project) {
       continue;
      }

      target = path.join(
       project.root,
       rel.endsWith('.rst') ? rel : `${rel}.rst`
      );
     } else {
      /* -------- локальная ссылка -------- */

      target = path.join(
       path.dirname(doc.fileName),
       raw.endsWith('.rst') ? raw : `${raw}.rst`
      );
     }

     if (!target || !fs.existsSync(target)) {
      continue;
     }

     const uri = vscode.Uri.file(target);
     const link = new vscode.DocumentLink(range, uri);
     link.tooltip = `Открыть файл в новой вкладке`;

     links.push(link);
    }

    return links;
   }
  }
 );

 context.subscriptions.push(provider);
}
