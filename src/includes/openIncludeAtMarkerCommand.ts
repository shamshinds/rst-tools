// src/includes/openIncludeAtMarkerCommand.ts
// FIX: защита от ситуации когда вместо файла передали директорию (EISDIR)

import * as vscode from 'vscode';
import * as fs from 'fs';

export const OPEN_INCLUDE_AT_MARKER_CMD = 'rstTools.openIncludeAtMarker';

function normalizeMarker(s: string): string {
 return s.trim().replace(/\s+/g, ' ');
}

function findMarkerLineSmart(text: string, marker: string): number | null {
 const wantedExact = marker.trim();
 const wantedNorm = normalizeMarker(marker);

 const lines = text.split(/\r?\n/);

 for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === wantedExact) return i;
 }

 for (let i = 0; i < lines.length; i++) {
  if (normalizeMarker(lines[i]) === wantedNorm) return i;
 }

 return null;
}

async function sleep(ms: number) {
 return new Promise(resolve => setTimeout(resolve, ms));
}

export function registerOpenIncludeAtMarkerCommand(
 context: vscode.ExtensionContext
) {
 context.subscriptions.push(
  vscode.commands.registerCommand(
   OPEN_INCLUDE_AT_MARKER_CMD,
   async (args: { file?: string; marker?: string }) => {
    console.log('[INCLUDE OPEN CMD]', args);

    const filePath = args?.file;
    if (!filePath) return;

    // ✅ FIX: если это директория — не читаем её
    try {
     if (!fs.existsSync(filePath)) {
      vscode.window.showErrorMessage(`Include file not found: ${filePath}`);
      return;
     }

     const st = fs.statSync(filePath);
     if (!st.isFile()) {
      vscode.window.showErrorMessage(
       `Include path is not a file: ${filePath}`
      );
      return;
     }
    } catch (e) {
     vscode.window.showErrorMessage(
      `Failed to access include target: ${filePath}`
     );
     return;
    }

    const uri = vscode.Uri.file(filePath);

    const editor = await vscode.window.showTextDocument(uri, {
     preview: true,
     viewColumn: vscode.ViewColumn.Active
    });

    let line = 0;

    try {
     const text = fs.readFileSync(filePath, 'utf-8');

     if (args.marker) {
      const found = findMarkerLineSmart(text, args.marker);
      if (found !== null) line = found;
      else console.log('[INCLUDE OPEN CMD] marker not found:', args.marker);
     } else {
      console.log('[INCLUDE OPEN CMD] no marker passed');
     }
    } catch (e) {
     console.log('[INCLUDE OPEN CMD] read failed', e);
    }

    const doJump = async () => {
     const pos = new vscode.Position(line, 0);
     editor.selection = new vscode.Selection(pos, pos);
     editor.revealRange(
      new vscode.Range(pos, pos),
      vscode.TextEditorRevealType.InCenter
     );
     await vscode.commands.executeCommand('revealLine', {
      lineNumber: line,
      at: 'center'
     });
    };

    await doJump();
    await sleep(30);
    await doJump();
    await sleep(60);
    await doJump();
   }
  )
 );
}
