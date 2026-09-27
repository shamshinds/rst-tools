import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { filterRstContent, collectTags, ALL_TAG } from './contentFilter';
import { getFilterTags } from '../utils/settings';

export const PREVIEW_FILTERED_CMD = 'rstTools.previewFilteredContent';

/** Схема виртуальных документов с отфильтрованным содержимым. */
export const FILTER_SCHEME = 'rst-filter';

/**
 * URI предпросмотра: путь задает имя вкладки и расширение `.rst`
 * (чтобы работала подсветка), а в query лежит путь к исходному файлу.
 */
function buildPreviewUri(sourcePath: string, tag: string): vscode.Uri {
 const base = path.basename(sourcePath).replace(/\.[^.]+$/, '');

 return vscode.Uri.from({
  scheme: FILTER_SCHEME,
  path: `/${base}.${tag}.rst`,
  query: sourcePath
 });
}

/** Читает исходник: из открытого документа, чтобы видеть несохраненные правки. */
function readSource(sourcePath: string): string {
 const open = vscode.workspace.textDocuments.find(d => d.fileName === sourcePath);
 if (open) return open.getText();

 try {
  return fs.readFileSync(sourcePath, 'utf-8');
 } catch {
  return '';
 }
}

class FilteredContentProvider implements vscode.TextDocumentContentProvider {
 private readonly changeEmitter = new vscode.EventEmitter<vscode.Uri>();
 readonly onDidChange = this.changeEmitter.event;

 /** Открытые предпросмотры, чтобы обновлять их при правке исходника. */
 private readonly opened = new Set<string>();

 provideTextDocumentContent(uri: vscode.Uri): string {
  this.opened.add(uri.toString());

  const sourcePath = uri.query;
  const tag = this.tagFromUri(uri);

  return filterRstContent(readSource(sourcePath), tag);
 }

 /** Тег зашит в имя файла: `<base>.<tag>.rst`. */
 private tagFromUri(uri: vscode.Uri): string {
  const name = path.basename(uri.path).replace(/\.rst$/, '');
  const dot = name.lastIndexOf('.');
  return dot === -1 ? ALL_TAG : name.slice(dot + 1);
 }

 /** Перерисовывает предпросмотры, построенные по этому исходнику. */
 refreshFor(sourcePath: string) {
  for (const raw of this.opened) {
   const uri = vscode.Uri.parse(raw);
   if (uri.query === sourcePath) {
    this.changeEmitter.fire(uri);
   }
  }
 }

 forget(uri: vscode.Uri) {
  this.opened.delete(uri.toString());
 }

 dispose() {
  this.changeEmitter.dispose();
 }
}

/** Закрывает вкладки предпросмотра, построенные по этому исходнику. */
async function closePreviews(sourcePath: string): Promise<boolean> {
 const victims = vscode.window.tabGroups.all
  .flatMap(group => group.tabs)
  .filter(tab => {
   const input = tab.input as { uri?: vscode.Uri } | undefined;
   return input?.uri?.scheme === FILTER_SCHEME && input.uri.query === sourcePath;
  });

 if (victims.length === 0) return false;

 await vscode.window.tabGroups.close(victims);
 return true;
}

/**
 * Исходный файл для предпросмотра: либо активный `.rst`, либо исходник
 * того предпросмотра, который сейчас открыт.
 */
function resolveSourceDocument(): { path: string; text: string } | null {
 const editor = vscode.window.activeTextEditor;
 if (!editor) return null;

 const doc = editor.document;

 if (doc.uri.scheme === FILTER_SCHEME) {
  const sourcePath = doc.uri.query;
  return sourcePath ? { path: sourcePath, text: readSource(sourcePath) } : null;
 }

 if (doc.languageId !== 'restructuredtext') return null;

 return { path: doc.fileName, text: doc.getText() };
}

export function registerFilterPreviewCommand(context: vscode.ExtensionContext) {
 const provider = new FilteredContentProvider();

 context.subscriptions.push(
  provider,
  vscode.workspace.registerTextDocumentContentProvider(FILTER_SCHEME, provider),

  // Предпросмотр следует за правками исходника.
  vscode.workspace.onDidChangeTextDocument(e => {
   if (e.document.uri.scheme === 'file') provider.refreshFor(e.document.fileName);
  }),
  vscode.workspace.onDidCloseTextDocument(doc => {
   if (doc.uri.scheme === FILTER_SCHEME) provider.forget(doc.uri);
  })
 );

 const cmd = vscode.commands.registerCommand(PREVIEW_FILTERED_CMD, async () => {
  const source = resolveSourceDocument();
  if (!source) {
   vscode.window.showWarningMessage('Откройте .rst-файл, чтобы выбрать версию документа');
   return;
  }

  const found = collectTags(source.text);
  const configured = getFilterTags();

  // Настройка нужна, чтобы посмотреть версию, конструкций которой
  // в этом файле нет: тогда отфильтрованный контент просто исчезнет.
  const tags = [...new Set([...configured, ...found])]
   .sort((a, b) => a.localeCompare(b));

  const items: vscode.QuickPickItem[] = [
   {
    label: ALL_TAG,
    description: 'исходный вид — вся разметка на месте',
    detail: 'Закрывает предпросмотр и возвращает к исходному файлу'
   },
   ...tags.map(tag => ({
    label: tag,
    description: found.includes(tag)
     ? 'есть в этом файле'
     : 'в этом файле не встречается',
    detail: `Оставить содержимое с тегом ${tag}, остальное убрать`
   }))
  ];

  const picked = await vscode.window.showQuickPick(items, {
   title: `Версия документа: ${path.basename(source.path)}`,
   placeHolder: 'Выберите тег'
  });

  if (!picked) return;

  if (picked.label === ALL_TAG) {
   const closed = await closePreviews(source.path);

   const doc = await vscode.workspace.openTextDocument(source.path);
   await vscode.window.showTextDocument(doc, { preview: false });

   if (!closed) {
    vscode.window.showInformationMessage(
     'Файл и так показан в исходном виде — предпросмотр не был открыт'
    );
   }
   return;
  }

  const uri = buildPreviewUri(source.path, picked.label);
  const preview = await vscode.workspace.openTextDocument(uri);

  // Пересобираем на случай, если вкладка с этим тегом уже была открыта.
  provider.refreshFor(source.path);

  await vscode.window.showTextDocument(preview, {
   viewColumn: vscode.ViewColumn.Beside,
   preview: false,
   preserveFocus: false
  });
 });

 context.subscriptions.push(cmd);
}
