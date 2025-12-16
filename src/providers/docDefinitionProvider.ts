import * as vscode from 'vscode';
import { parseDocLinks } from '../doc/docParser';
import { resolveDocTarget, parseIntersphinxMapping } from '../doc/docResolver';
import { discoverProjects } from '../doc/projectRegistry';
import { findConfPy } from '../project/projectResolver';

export function registerDocDefinitionProvider(
 context: vscode.ExtensionContext
) {
 console.log('[RST DOC] register definition provider');
 const provider = vscode.languages.registerDefinitionProvider(
  [
   { language: 'restructuredtext' },
   { language: 'rst' }
  ],
  {
   async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
   ): Promise<vscode.Definition | null> {

    console.log('[RST DOC] provideDefinition called');

    const text = document.getText();
    const offset = document.offsetAt(position);

    const links = parseDocLinks(text);
    const link = links.find(
     l => offset >= l.rangeStart && offset <= l.rangeEnd
    );

    if (!link) {
     return null;
    }

    const confPath = findConfPy(document.fileName);
    if (!confPath) {
     return null;
    }

    const allProjects = discoverProjects(
     vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? ''
    );

    const currentProject = allProjects.find(p =>
     document.fileName.startsWith(p.root)
    );
    if (!currentProject) {
     return null;
    }

    const allowedProjects =
     parseIntersphinxMapping(confPath);

    const target = resolveDocTarget(
     document.fileName,
     currentProject,
     allProjects,
     allowedProjects,
     link.target
    );

    if (!target.exists) {
     return null;
    }

    const uri = vscode.Uri.file(target.filePath);
    const targetDoc =
     await vscode.workspace.openTextDocument(uri);

    // Переходим в начало файла
    const pos = new vscode.Position(0, 0);

    return new vscode.Location(uri, pos);
   }
  }
 );

 context.subscriptions.push(provider);
}
