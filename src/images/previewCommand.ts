import * as vscode from 'vscode';
import * as fs from 'fs';

export const OPEN_IMAGE_CMD = 'rstTools.openImagePreview';

export function registerImagePreviewCommand(ctx: vscode.ExtensionContext) {

 const cmd = vscode.commands.registerCommand(
  OPEN_IMAGE_CMD,
  async (imgPath: string) => {

   if (!fs.existsSync(imgPath)) {
    vscode.window.showErrorMessage(`Файл не найден: ${imgPath}`);
    return;
   }

   const uri = vscode.Uri.file(imgPath);
   await vscode.commands.executeCommand('vscode.open', uri);
  }
 );

 ctx.subscriptions.push(cmd);
}
