// src/providers/includeSnippetDefinitionProvider.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import { findConfPy } from '../project/projectResolver';
import { parseIncludeSnippets } from '../parsing/includeSnippetParser';

function findMarkerLine(text: string, marker: string): number | null {
 const lines = text.split(/\r?\n/);
 for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(marker)) return i;
 }
 return null;
}

function getIncludePathRangeOnLine(
 document: vscode.TextDocument,
 position: vscode.Position
): { value: string; range: vscode.Range } | null {
 const lineText = document.lineAt(position.line).text;

 const m = /\.\.\s+include::\s+(.+)\s*$/.exec(lineText);
 if (!m) return null;

 const rawValue = (m[1] ?? '').trim();
 if (!rawValue) return null;

 const start = lineText.indexOf(rawValue);
 if (start === -1) return null;

 const end = start + rawValue.length;

 return {
  value: rawValue,
  range: new vscode.Range(
   new vscode.Position(position.line, start),
   new vscode.Position(position.line, end)
  )
 };
}

function findStartAfterMarkerInSameBlock(
 docText: string,
 hitStartOffset: number,
 hitEndOffset: number
): string | null {
 const block = docText.slice(hitStartOffset, hitEndOffset);
 const m = /:start-after:\s*(.+)\s*$/m.exec(block);
 if (!m) return null;
 return (m[1] ?? '').trim() || null;
}

export function registerIncludeSnippetDefinitionProvider(
 context: vscode.ExtensionContext
) {
 const provider = vscode.languages.registerDefinitionProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   provideDefinition(doc, pos) {
    // Ctrl+Click только по пути после ".. include::"
    const includePathInfo = getIncludePathRangeOnLine(doc, pos);
    if (!includePathInfo) return;

    if (!includePathInfo.range.contains(pos)) return;

    const confPy = findConfPy(doc.fileName);
    if (!confPy) return;

    const docText = doc.getText();

    const snippets = parseIncludeSnippets(docText, doc.fileName, confPy);
    const offset = doc.offsetAt(pos);

    const hit = snippets.find(
     s => offset >= s.rangeStartOffset && offset <= s.rangeEndOffset
    );
    if (!hit) return;

    if (!fs.existsSync(hit.includeFileAbs)) return;

    const marker = findStartAfterMarkerInSameBlock(
     docText,
     hit.rangeStartOffset,
     hit.rangeEndOffset
    );

    let targetLine = 0;
    let targetCharEnd = 1; // ✅ не нулевой диапазон!

    try {
     const fileText = fs.readFileSync(hit.includeFileAbs, 'utf-8');

     const lines = fileText.split(/\r?\n/);

     if (marker) {
      const markerLine = findMarkerLine(fileText, marker);
      if (markerLine !== null) targetLine = markerLine;
     }

     // длина строки для "не пустого" range
     const lineText = lines[targetLine] ?? '';
     targetCharEnd = Math.max(1, lineText.length);
    } catch {
     // ignore
    }

    const targetRange = new vscode.Range(
     new vscode.Position(targetLine, 0),
     new vscode.Position(targetLine, targetCharEnd)
    );

    const link: vscode.LocationLink = {
     originSelectionRange: includePathInfo.range,
     targetUri: vscode.Uri.file(hit.includeFileAbs),
     targetRange,
     targetSelectionRange: targetRange
    };

    return [link];
   }
  }
 );

 context.subscriptions.push(provider);
}
