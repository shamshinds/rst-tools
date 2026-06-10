import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { discoverProjects } from '../doc/projectRegistry';
import { getEffectiveFilePath } from '../utils/contextResolver';
import { resolveWorkspaceRoot } from '../utils/workspaceResolver';
import { normalizeDocTarget, splitDocRole, readRstTitle, resolveLocalDocTarget } from '../doc/docUtils';
import { findConfPy } from '../project/projectResolver';
import { includeContext } from '../providers/includeSnippetHoverProvider';

function getDocRoleRange(
 document: vscode.TextDocument,
 position: vscode.Position
): vscode.Range | null {
 const line = document.lineAt(position.line).text;
 const anchor = ':doc:`';

 const idx = line.lastIndexOf(anchor, position.character);
 if (idx === -1) return null;

 const start = idx + anchor.length;
 const end = line.indexOf('`', start);
 if (end === -1) return null;

 if (position.character > end) return null;

 return new vscode.Range(
  new vscode.Position(position.line, start),
  new vscode.Position(position.line, end)
 );
}

export function registerDocHoverProvider(context: vscode.ExtensionContext) {
 const provider = vscode.languages.registerHoverProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   provideHover(doc, pos) {
    const range = getDocRoleRange(doc, pos);
    if (!range) return;

    const raw = doc.getText(range);
    const { target } = splitDocRole(raw);
    const link = normalizeDocTarget(target);
    if (!link) return;

    const effectivePath = getEffectiveFilePath(doc);
    const parentContext = includeContext.get(doc.fileName);
    const workspaceRoot = resolveWorkspaceRoot(effectivePath, doc);
    const md = new vscode.MarkdownString();

    if (link.includes(':')) {
     const [projectId, relPath] = link.split(':', 2);
     if (!workspaceRoot) return;

     const project = discoverProjects(workspaceRoot).find(p => p.id === projectId);
     if (!project) return;

     const full = path.resolve(project.root, relPath);
     if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return;

     const title = readRstTitle(full);
     if (title) md.appendMarkdown(`**Заголовок:** ${title}\n\n`);
     md.appendMarkdown(`**Путь к файлу**: \`${full}\`\n\n`);
     if (parentContext) md.appendMarkdown(`**Контекст**: \`${parentContext}\``);

     return new vscode.Hover(md);
    }

    const confPath = findConfPy(effectivePath);
    const full = resolveLocalDocTarget(link, effectivePath, confPath);

    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
     const title = readRstTitle(full);
     if (title) md.appendMarkdown(`**Заголовок**: ${title}\n\n`);
     md.appendMarkdown(`**Путь к файлу**: \`${full}\`\n\n`);
     if (parentContext) md.appendMarkdown(`**Контекст**: \`${parentContext}\``);
    }

    return new vscode.Hover(md);
   }
  }
 );

 context.subscriptions.push(provider);
}
