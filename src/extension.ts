import * as vscode from 'vscode';
import { registerCompletionProvider } from './providers/completionProvider';
import { registerHoverProvider } from './providers/hoverProvider';
import { registerDiagnosticsProvider } from './providers/diagnosticsProvider';
import { registerDefinitionProvider } from './providers/definitionProvider';
import { registerDocCompletionProvider } from './providers/docCompletionProvider';
import { registerDocDiagnosticsProvider } from './providers/docDiagnosticsProvider';
import { registerDocDefinitionProvider } from './providers/docDefinitionProvider';
import { registerImagePreviewCommand } from './images/previewCommand';
import { registerDocHoverProvider } from './providers/docHoverProvider';
import { registerIncludeSnippetHoverProvider } from './providers/includeSnippetHoverProvider';
import { registerIncludeSnippetDiagnosticsProvider } from './providers/includeSnippetDiagnosticsProvider';
import { registerOpenIncludeAtMarkerCommand } from './includes/openIncludeAtMarkerCommand';
import { registerIncludeSnippetLinkProvider } from './providers/includeSnippetLinkProvider';


export function activate(context: vscode.ExtensionContext) {
 console.log('[RST] Extension activated');
 
 registerImagePreviewCommand(context);

 registerCompletionProvider(context);
 registerHoverProvider(context);
 registerDiagnosticsProvider(context);
 registerDefinitionProvider(context);
 
 registerDocCompletionProvider(context);
 registerDocDiagnosticsProvider(context);
 registerDocDefinitionProvider(context);
 registerDocHoverProvider(context);

 registerIncludeSnippetHoverProvider(context);
 registerIncludeSnippetDiagnosticsProvider(context);
 registerOpenIncludeAtMarkerCommand(context);
 registerIncludeSnippetLinkProvider(context);

}

export function deactivate() { }
