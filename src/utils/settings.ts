import * as vscode from 'vscode';

const DEFAULT_PROJECTS_ROOTS = ['source/ru/ru'];

/**
 * Списки сегментов пути от корня workspace до каталогов с проектами документации.
 * Настраивается через rstTools.projectsRoots (POSIX-стиль, "/" как разделитель).
 */
export function getProjectsRootSegmentsList(): string[][] {
 const raw = vscode.workspace
  .getConfiguration('rstTools')
  .get<string[]>('projectsRoots', DEFAULT_PROJECTS_ROOTS);

 const values = (raw ?? []).map(v => (v ?? '').trim()).filter(Boolean);
 const list = values.length > 0 ? values : DEFAULT_PROJECTS_ROOTS;

 return list.map(v => v.split(/[\\/]+/).filter(Boolean));
}

export function getProjectsRootLabel(): string {
 return getProjectsRootSegmentsList()
  .map(segments => segments.join('/'))
  .join(', ');
}

export function isVariableHighlightEnabled(): boolean {
 return vscode.workspace
  .getConfiguration('rstTools')
  .get<boolean>('highlightVariables', false);
}

export function getIncludePreviewLines(): number {
 const value = vscode.workspace
  .getConfiguration('rstTools')
  .get<number>('includePreviewLines', 3);

 return Number.isFinite(value) && value > 0 ? Math.floor(value) : 3;
}
