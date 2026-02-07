import * as vscode from 'vscode';

export const OPEN_INCLUDE_AT_MARKER_CMD =
 'rst.openIncludeAtMarker';

export function registerOpenIncludeAtMarkerCommand(
 context: vscode.ExtensionContext
) {
 context.subscriptions.push(
  vscode.commands.registerCommand(
   OPEN_INCLUDE_AT_MARKER_CMD,
   async (args?: [{ file: string; marker?: string }]) => {
    const arg = args?.[0];

    console.log('[INCLUDE OPEN CMD]', arg);

    if (!arg?.file) {
     console.log('[INCLUDE OPEN CMD] no args');
     return;
    }

    const doc = await vscode.workspace.openTextDocument(arg.file);
    const editor = await vscode.window.showTextDocument(doc);

    if (!arg.marker) return;

    const text = doc.getText();
    const idx = text.indexOf(arg.marker);
    if (idx === -1) return;

    const pos = doc.positionAt(idx);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(
     new vscode.Range(pos, pos),
     vscode.TextEditorRevealType.InCenter
    );
   }
  )
 );
}
