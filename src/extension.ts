import * as vscode from 'vscode';
import { registerCompletionProvider } from './providers/completionProvider';
import { registerHoverProvider } from './providers/hoverProvider';
import { registerDiagnosticsProvider } from './providers/diagnosticsProvider';
import { registerDefinitionProvider } from './providers/definitionProvider';
import { registerDocCompletionProvider } from './providers/docCompletionProvider';
import { registerDocDiagnosticsProvider } from './providers/docDiagnosticsProvider';
import { registerDocDefinitionProvider } from './providers/docDefinitionProvider';
import { registerDocLinkProvider } from './providers/docLinkProvider';
import { registerImagePreviewCommand } from './images/previewCommand';
import { registerDocHoverProvider } from './providers/docHoverProvider';
import { registerIncludeSnippetHoverProvider } from './providers/includeSnippetHoverProvider';
import { registerIncludeSnippetDiagnosticsProvider } from './providers/includeSnippetDiagnosticsProvider';
import { registerIncludeSnippetLinkProvider } from './providers/includeSnippetLinkProvider';
import { registerIncludeDefinitionProvider } from './providers/includeDefinitionProvider';
import { registerTermCompletionProvider } from './providers/termCompletionProvider';
import { registerTermHoverProvider } from './providers/termHoverProvider';
import { registerTermDiagnosticsProvider } from './providers/termDiagnosticsProvider';
import { registerFlatTableCommand } from './tables/flatTableCommand';
import { registerVariableHighlightProvider } from './providers/variableHighlightProvider';
import { registerConvertUrlToDocCommand } from './urls/convertUrlToDocCommand';
import { registerMaskUuidCommand } from './uuid/maskUuidCommand';

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
 registerDocLinkProvider(context);

 registerIncludeSnippetHoverProvider(context);
 registerIncludeSnippetDiagnosticsProvider(context);
 registerIncludeSnippetLinkProvider(context);
 registerIncludeDefinitionProvider(context);

 registerTermCompletionProvider(context);
 registerTermHoverProvider(context);
 registerTermDiagnosticsProvider(context);

 registerFlatTableCommand(context);

 registerVariableHighlightProvider(context);

 registerConvertUrlToDocCommand(context);
 registerMaskUuidCommand(context);

}

export function deactivate() { }
