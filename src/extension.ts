import * as vscode from 'vscode';
import { registerCompletionProvider } from './providers/completionProvider';
import { registerHoverProvider } from './providers/hoverProvider';
import { registerDiagnosticsProvider } from './providers/diagnosticsProvider';
import { registerDefinitionProvider } from './providers/definitionProvider';
import { registerDocCompletionProvider } from './providers/docCompletionProvider';
import { registerDocDiagnosticsProvider } from './providers/docDiagnosticsProvider';
import { registerDocDefinitionProvider } from './providers/docDefinitionProvider';
import { registerImagePreviewCommand } from './images/previewCommand';
import { startThumbCleanupScheduler } from './images/cleanupScheduler';

export function activate(context: vscode.ExtensionContext) {
 console.log('[RST] Extension activated');
 
 registerImagePreviewCommand(context);
 startThumbCleanupScheduler();

 registerCompletionProvider(context);
 registerHoverProvider(context);
 registerDiagnosticsProvider(context);
 registerDefinitionProvider(context);
 
 registerDocCompletionProvider(context);
 registerDocDiagnosticsProvider(context);
 registerDocDefinitionProvider(context);
 
}

export function deactivate() { }
