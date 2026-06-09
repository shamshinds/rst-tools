import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { findConfPy } from '../project/projectResolver';
import { parseIncludeSnippets } from '../parsing/includeSnippetParser';
import { includeContext } from '../providers/includeSnippetHoverProvider';
import { resolveContext } from '../utils/contextResolver';

export const pendingIncludeContext = new Map<string, string>();

function normalize(p: string): string {
 return path.normalize(p);
}

function getEffectiveFilePath(doc: vscode.TextDocument): string {
 return resolveContext(normalize(doc.fileName));
}

function extractMarkerFromFollowingParamLines(
 doc: vscode.TextDocument,
 includeLineNo: number
): string | undefined {
 for (let i = includeLineNo + 1; i < doc.lineCount; i++) {
  const line = doc.lineAt(i).text;
  if (!/^[ \t]+:/.test(line)) break;
  const m = /:start-after:\s*(.+)\s*$/.exec(line);
  if (m) return (m[1] ?? '').trim();
 }
 return undefined;
}

export function registerIncludeSnippetLinkProvider(context: vscode.ExtensionContext) {
 context.subscriptions.push(
  vscode.workspace.onDidOpenTextDocument(doc => {
   const file = normalize(doc.fileName);
   if (pendingIncludeContext.has(file)) {
    includeContext.set(file, pendingIncludeContext.get(file)!);
    pendingIncludeContext.delete(file);
   }
  })
 );

 const provider = vscode.languages.registerDocumentLinkProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   provideDocumentLinks(doc) {
    const effectivePath = getEffectiveFilePath(doc);
    const confPy = findConfPy(effectivePath);
    if (!confPy) return [];

    const snippets = parseIncludeSnippets(doc.getText(), doc.fileName, confPy);
    const links: vscode.DocumentLink[] = [];

    for (const s of snippets) {
     const includeRange = new vscode.Range(
      new vscode.Position(s.line, s.columnStart),
      new vscode.Position(s.line, s.columnEnd)
     );

     const marker = extractMarkerFromFollowingParamLines(doc, s.line);
     const effectiveBaseDir = path.dirname(effectivePath);
     const realBaseDir = path.dirname(doc.fileName);
     const relativePath = path.relative(realBaseDir, s.includeFileAbs);
     const resolvedFile = normalize(path.resolve(effectiveBaseDir, relativePath));
     const parent = normalize(doc.fileName);

     pendingIncludeContext.set(resolvedFile, parent);

     const payload = encodeURIComponent(JSON.stringify([{ file: resolvedFile, marker, parent }]));
     const cmdUri = vscode.Uri.parse(`command:rstTools.openIncludeFile?${payload}`);

     const link = new vscode.DocumentLink(includeRange, cmdUri);
     link.tooltip = 'Открыть include';

     if (fs.existsSync(resolvedFile)) {
      links.push(link);
     }
    }

    return links;
   }
  }
 );

 context.subscriptions.push(provider);
}
