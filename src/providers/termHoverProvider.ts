import * as vscode from 'vscode';

import { resolveWorkspaceRoot } from '../utils/workspaceResolver';
import { getEffectiveFilePath } from '../utils/contextResolver';
import { findGlossaryDir, parseGlossaryDir } from '../parsing/glossaryParser';

function extractTermName(raw: string): string {
 const lt = raw.lastIndexOf('<');
 const gt = raw.lastIndexOf('>');
 if (lt !== -1 && gt !== -1 && gt > lt) {
  return raw.slice(lt + 1, gt).trim();
 }
 return raw.trim();
}

function getTermRoleRange(
 document: vscode.TextDocument,
 position: vscode.Position
): { range: vscode.Range; term: string } | null {
 const line = document.lineAt(position.line).text;
 const anchor = ':term:`';

 const idx = line.lastIndexOf(anchor, position.character);
 if (idx === -1) return null;

 const start = idx + anchor.length;
 const end = line.indexOf('`', start);
 if (end === -1) return null;
 if (position.character > end) return null;

 const raw = line.slice(start, end);
 return {
  range: new vscode.Range(
   new vscode.Position(position.line, start),
   new vscode.Position(position.line, end)
  ),
  term: extractTermName(raw),
 };
}

export function registerTermHoverProvider(context: vscode.ExtensionContext) {
 const provider = vscode.languages.registerHoverProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   provideHover(doc, pos) {
    const hit = getTermRoleRange(doc, pos);
    if (!hit) return;

    const effectivePath = getEffectiveFilePath(doc);
    const workspaceRoot = resolveWorkspaceRoot(effectivePath, doc);
    if (!workspaceRoot) return;

    const glossaryDir = findGlossaryDir(workspaceRoot);
    if (!glossaryDir) return;

    const terms = parseGlossaryDir(glossaryDir);
    const found = terms.find(t => t.term.toLowerCase() === hit.term.toLowerCase());
    if (!found) return;

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${found.term}**\n\n`);
    if (found.definition) md.appendMarkdown(found.definition);

    return new vscode.Hover(md, hit.range);
   }
  }
 );

 context.subscriptions.push(provider);
}
