// src/providers/docHoverProvider.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { findConfPy } from '../project/projectResolver';
import { parseIntersphinxMapping } from '../doc/docResolver';
import { discoverProjects } from '../doc/projectRegistry';

/* ======================= helpers ======================= */

function getWorkspaceRoot(doc: vscode.TextDocument): string | null {
 const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
 return folder ? folder.uri.fsPath : null;
}

function resolveWorkspaceRootFromFile(filePath: string): string | null {
 let dir = path.dirname(filePath);

 while (true) {
  const candidate = path.join(dir, 'source', 'ru', 'ru');
  if (fs.existsSync(candidate)) return dir;

  const parent = path.dirname(dir);
  if (parent === dir) break;
  dir = parent;
 }

 return null;
}

function getDocRoleRange(
 document: vscode.TextDocument,
 position: vscode.Position
): vscode.Range | null {

 const line = document.lineAt(position.line).text;
 const anchor = ':doc:`';

 const idx = line.lastIndexOf(anchor, position.character);
 if (idx === -1) return null;

 const start = idx + anchor.length;
 const end = line.indexOf('`', start);
 if (end === -1) return null;

 if (position.character > end) return null;

 return new vscode.Range(
  new vscode.Position(position.line, start),
  new vscode.Position(position.line, end)
 );
}

function normalizeDocTarget(raw: string): string {
 let p = raw.trim();

 // :doc:`text <path>`
 const lt = p.lastIndexOf('<');
 const gt = p.lastIndexOf('>');
 if (lt !== -1 && gt !== -1 && gt > lt) {
  p = p.slice(lt + 1, gt).trim();
 }

 // если расширение не указано — считаем .rst
 if (p && !p.endsWith('.rst') && !p.endsWith('/')) {
  p += '.rst';
 }

 return p;
}

/**
 * Заголовок документа: первая строка вида
 * Title
 * =====
 * или
 * Title
 * -----
 */
function readRstTitle(filePath: string): string | null {
 try {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length - 1; i++) {
   const title = lines[i].trim();
   const underline = lines[i + 1].trim();

   if (!title) continue;
   if (!underline) continue;

   // underline должен быть >= длины title и состоять из одного символа
   if (underline.length < title.length) continue;

   const ch = underline[0];
   if (!'=-~^"\'`:+#*'.includes(ch)) continue;

   if ([...underline].every(c => c === ch)) {
    return title;
   }
  }

  return null;
 } catch {
  return null;
 }
}

/* ======================= provider ======================= */

export function registerDocHoverProvider(context: vscode.ExtensionContext) {
 const provider = vscode.languages.registerHoverProvider(
  { scheme: 'file', language: 'restructuredtext' },
  {
   provideHover(doc, pos) {
    const range = getDocRoleRange(doc, pos);
    if (!range) return;

    const raw = doc.getText(range);
    const link = normalizeDocTarget(raw);
    if (!link) return;

    const workspaceRoot =
     getWorkspaceRoot(doc) ??
     resolveWorkspaceRootFromFile(doc.fileName);

    /* ---------------------- EXTERNAL ---------------------- */
    if (link.includes(':')) {
     const [projectId, relPath] = link.split(':', 2);

     const confPy = findConfPy(doc.fileName);
     if (!confPy) return;

     const allowed = parseIntersphinxMapping(confPy);
     if (!allowed.has(projectId)) {
      return new vscode.Hover(
       `❌ Проект **${projectId}** не подключён через intersphinx_mapping`
      );
     }

     if (!workspaceRoot) return;

     const projects = discoverProjects(workspaceRoot);
     const project = projects.find(p => p.id === projectId);
     if (!project) {
      return new vscode.Hover(
       `❌ Проект **${projectId}** не найден в workspace`
      );
     }

     const full = path.resolve(project.root, relPath);
     const exists = fs.existsSync(full);

     const md = new vscode.MarkdownString();
     md.appendMarkdown(`**doc →** \`${projectId}:${relPath}\`\n\n`);

     if (exists) {
      const title = readRstTitle(full);
      if (title) {
       md.appendMarkdown(`**Заголовок:** ${title}\n\n`);
      }
      md.appendMarkdown(`Путь: \`${full}\``);
     } else {
      md.appendMarkdown(`❌ Файл не найден\n\nПуть: \`${full}\``);
     }

     return new vscode.Hover(md);
    }

    /* ----------------------- LOCAL ------------------------ */

    const full = path.resolve(path.dirname(doc.fileName), link);
    const exists = fs.existsSync(full);

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**doc →** \`${link}\`\n\n`);

    if (exists) {
     const title = readRstTitle(full);
     if (title) {
      md.appendMarkdown(`**Заголовок:** ${title}\n\n`);
     }
     md.appendMarkdown(`Путь: \`${full}\``);
    } else {
     md.appendMarkdown(`❌ Файл не найден\n\nПуть: \`${full}\``);
    }

    return new vscode.Hover(md);
   }
  }
 );

 context.subscriptions.push(provider);
}
