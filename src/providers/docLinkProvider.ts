import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { discoverProjects } from '../doc/projectRegistry';
import { getEffectiveFilePath } from '../utils/contextResolver';
import { resolveWorkspaceRoot } from '../utils/workspaceResolver';
import { DOC_LINK_RE, extractDocTarget } from '../doc/docUtils';

export function registerDocLinkProvider(context: vscode.ExtensionContext) {
 const provider = vscode.languages.registerDocumentLinkProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   provideDocumentLinks(doc) {
    const links: vscode.DocumentLink[] = [];
    const text = doc.getText();

    const effectivePath = getEffectiveFilePath(doc);
    const workspaceRoot = resolveWorkspaceRoot(effectivePath, doc);
    if (!workspaceRoot) return links;

    const re = new RegExp(DOC_LINK_RE.source, 'g');
    let m: RegExpExecArray | null;

    while ((m = re.exec(text)) !== null) {
     const raw = extractDocTarget(m[1]);
     const start = doc.positionAt(m.index + ':doc:`'.length);
     const end = doc.positionAt(m.index + m[0].length - 1);
     const range = new vscode.Range(start, end);

     let target: string | null = null;

     if (raw.includes(':')) {
      const [projectId, rel] = raw.split(':', 2);

      const project = discoverProjects(workspaceRoot).find(p => p.id === projectId);
      if (!project) continue;

      target = path.join(project.root, rel.endsWith('.rst') ? rel : `${rel}.rst`);
     } else {
      const baseDir = path.dirname(effectivePath);
      target = path.join(baseDir, raw.endsWith('.rst') ? raw : `${raw}.rst`);
     }

     if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) continue;

     const link = new vscode.DocumentLink(range, vscode.Uri.file(target));
     link.tooltip = 'Открыть файл в новой вкладке';
     links.push(link);
    }

    return links;
   }
  }
 );

 context.subscriptions.push(provider);
}
