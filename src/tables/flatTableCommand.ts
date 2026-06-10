import * as vscode from 'vscode';

export function registerFlatTableCommand(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('rstTools.insertFlatTable', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Нет активного редактора');
            return;
        }
        const panel = vscode.window.createWebviewPanel(
            'flatTableBuilder',
            'Конструктор flat-table',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );
        panel.webview.html = getWebviewHtml();
        panel.webview.onDidReceiveMessage((message) => {
            if (message.command === 'insert') {
                const rst = buildFlatTable(message.data);
                editor.edit((editBuilder) => {
                    editBuilder.insert(editor.selection.active, rst);
                });
                panel.dispose();
            }
        }, undefined, context.subscriptions);
    });
    context.subscriptions.push(disposable);
}

interface CellData {
    text: string;
    cspan: number;
    rspan: number;
}

interface TableData {
    columns: number;
    headerRows: number;
    bodyRows: number;
    widths: number[];
    headerCells: CellData[][];
    bodyCells: CellData[][];
    tableTitle: string;
}

function cellPrefix(cell: CellData): string {
    let prefix = '';
    if (cell.cspan > 0) { prefix += `:cspan:\`${cell.cspan}\` `; }
    if (cell.rspan > 0) { prefix += `:rspan:\`${cell.rspan}\` `; }
    return prefix;
}

function buildFlatTable(data: TableData): string {
    const { columns, headerRows, bodyRows, widths, headerCells, bodyCells, tableTitle } = data;
    const lines: string[] = [];

    const titlePart = tableTitle.trim() ? ` ${tableTitle.trim()}` : '';
    lines.push(`.. flat-table::${titlePart}`);
    if (headerRows > 0) {
        lines.push(`   :header-rows: ${headerRows}`);
    }
    lines.push(`   :widths: ${widths.join(' ')}`);
    lines.push('');

    for (let r = 0; r < headerRows; r++) {
        const row = headerCells[r] ?? [];
        for (let c = 0; c < columns; c++) {
            const cell = row[c] ?? { text: '', cspan: 0, rspan: 0 };
            const text = cell.text.trim() || `Заголовок ${c + 1}`;
            const prefix = cellPrefix(cell);
            if (c === 0) {
                lines.push(`   * - ${prefix}${text}`);
            } else {
                lines.push(`     - ${prefix}${text}`);
            }
        }
        lines.push('');
    }

    for (let r = 0; r < bodyRows; r++) {
        const row = bodyCells[r] ?? [];
        for (let c = 0; c < columns; c++) {
            const cell = row[c] ?? { text: '', cspan: 0, rspan: 0 };
            const prefix = cellPrefix(cell);
            if (c === 0) {
                lines.push(`   * - ${prefix}${cell.text}`);
            } else {
                lines.push(`     - ${prefix}${cell.text}`);
            }
        }
        lines.push('');
    }

    return lines.join('\n');
}

function getWebviewHtml(): string {
    return /* html */ `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Конструктор flat-table</title>
<style>
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 16px;
    max-width: 900px;
  }
  h2 { margin-top: 0; }
  .row { display: flex; gap: 16px; align-items: flex-end; margin-bottom: 12px; flex-wrap: wrap; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  label { font-size: 0.85em; color: var(--vscode-descriptionForeground); }
  input[type="number"], input[type="text"] {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #555);
    padding: 4px 6px;
    border-radius: 2px;
    font-size: inherit;
  }
  input[type="number"] { width: 60px; }
  input[type="text"] { width: 160px; }
  button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px 14px;
    border-radius: 2px;
    cursor: pointer;
    font-size: inherit;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
  #tableConfig { margin-top: 16px; }
  .section-title { font-weight: bold; margin-bottom: 8px; margin-top: 16px; }
  table.builder { border-collapse: collapse; margin-bottom: 12px; }
  table.builder td, table.builder th {
    border: 1px solid var(--vscode-panel-border, #555);
    padding: 4px 6px;
    vertical-align: top;
  }
  table.builder th {
    background: var(--vscode-editorGroupHeader-tabsBackground);
    font-weight: normal;
    font-size: 0.8em;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    padding: 3px 8px;
  }
  .row-label {
    font-size: 0.75em;
    color: var(--vscode-descriptionForeground);
    padding: 4px 8px;
    white-space: nowrap;
    vertical-align: middle;
  }
  .cell-box { display: flex; flex-direction: column; gap: 4px; }
  .cell-box input[type="text"] { width: 110px; }
  .span-row { display: flex; gap: 6px; align-items: center; }
  .span-row span { font-size: 0.75em; color: var(--vscode-descriptionForeground); white-space: nowrap; }
  .span-row input[type="number"] { width: 38px; padding: 2px 4px; }
  .header-row td { background: color-mix(in srgb, var(--vscode-editorGroupHeader-tabsBackground) 60%, transparent); }
  #preview {
    background: var(--vscode-textCodeBlock-background, #1e1e1e);
    color: var(--vscode-textPreformat-foreground);
    padding: 12px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.9em;
    border-radius: 4px;
    white-space: pre;
    overflow-x: auto;
    margin-top: 8px;
  }
  .actions { display: flex; gap: 8px; margin-top: 16px; }
</style>
</head>
<body>
<h2>Конструктор flat-table</h2>

<div class="row">
  <div class="field">
    <label>Название таблицы</label>
    <input type="text" id="tableTitle" placeholder="(необязательно)" style="width:240px" oninput="updatePreview()">
  </div>
</div>
<div class="row">
  <div class="field">
    <label>Столбцов</label>
    <input type="number" id="columns" value="3" min="1" max="20">
  </div>
  <div class="field">
    <label>Строк заголовка</label>
    <input type="number" id="headerRows" value="1" min="0" max="5">
  </div>
  <div class="field">
    <label>Строк данных</label>
    <input type="number" id="bodyRows" value="3" min="0" max="100">
  </div>
  <div>
    <button class="secondary" onclick="buildEditor()">Применить</button>
  </div>
</div>

<div id="tableConfig"></div>

<div class="section-title">Предпросмотр RST</div>
<div id="preview"></div>

<div class="actions">
  <button onclick="insertTable()">Вставить в документ</button>
</div>

<script>
const vscode = acquireVsCodeApi();
let state = { columns: 3, headerRows: 1, bodyRows: 3 };

function getInt(id, def) {
  const v = parseInt(document.getElementById(id).value, 10);
  return isNaN(v) || v < 0 ? def : v;
}

function cellInput(prefix, r, c) {
  const tid = prefix + r + '_' + c + '_text';
  const csid = prefix + r + '_' + c + '_cspan';
  const rsid = prefix + r + '_' + c + '_rspan';
  const ph = prefix === 'h' ? ('Заголовок ' + (c + 1)) : '';
  return \`<div class="cell-box">
    <input type="text" id="\${tid}" placeholder="\${ph}" oninput="updatePreview()">
    <div class="span-row">
      <span>cspan:</span>
      <input type="number" id="\${csid}" value="0" min="0" max="19" title="colspan — объединение столбцов (0 = нет)" oninput="updatePreview()">
      <span>rspan:</span>
      <input type="number" id="\${rsid}" value="0" min="0" max="99" title="rowspan — объединение строк (0 = нет)" oninput="updatePreview()">
    </div>
  </div>\`;
}

function snapshotInputs() {
  const snap = {};
  document.querySelectorAll('#tableConfig input').forEach(el => {
    if (el.id) snap[el.id] = el.value;
  });
  return snap;
}

function restoreInputs(snap) {
  Object.entries(snap).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
}

function buildEditor() {
  const snap = snapshotInputs();

  state.columns = Math.max(1, getInt('columns', 3));
  state.headerRows = Math.max(0, getInt('headerRows', 1));
  state.bodyRows = Math.max(0, getInt('bodyRows', 3));

  document.getElementById('columns').value = state.columns;
  document.getElementById('headerRows').value = state.headerRows;
  document.getElementById('bodyRows').value = state.bodyRows;

  const cols = state.columns;
  const hRows = state.headerRows;
  const bRows = state.bodyRows;
  let html = '';

  // Widths
  html += '<div class="section-title">Ширина столбцов</div>';
  html += '<table class="builder"><tr>';
  for (let c = 0; c < cols; c++) html += \`<th>Столбец \${c + 1}</th>\`;
  html += '</tr><tr>';
  for (let c = 0; c < cols; c++) {
    html += \`<td><input type="number" id="w\${c}" value="1" min="1" max="100" oninput="updatePreview()"></td>\`;
  }
  html += '</tr></table>';

  // Header rows
  if (hRows > 0) {
    html += '<div class="section-title">Строки заголовка</div>';
    html += '<table class="builder"><tr><th></th>';
    for (let c = 0; c < cols; c++) html += \`<th>Столбец \${c + 1}</th>\`;
    html += '</tr>';
    for (let r = 0; r < hRows; r++) {
      html += \`<tr class="header-row"><td class="row-label">Строка \${r + 1}</td>\`;
      for (let c = 0; c < cols; c++) {
        html += '<td>' + cellInput('h', r, c) + '</td>';
      }
      html += '</tr>';
    }
    html += '</table>';
  }

  // Body rows
  if (bRows > 0) {
    html += '<div class="section-title">Строки данных</div>';
    html += '<table class="builder"><tr><th></th>';
    for (let c = 0; c < cols; c++) html += \`<th>Столбец \${c + 1}</th>\`;
    html += '</tr>';
    for (let r = 0; r < bRows; r++) {
      html += \`<tr><td class="row-label">Строка \${r + 1}</td>\`;
      for (let c = 0; c < cols; c++) {
        html += '<td>' + cellInput('b', r, c) + '</td>';
      }
      html += '</tr>';
    }
    html += '</table>';
  }

  document.getElementById('tableConfig').innerHTML = html;
  restoreInputs(snap);
  updatePreview();
}

function readCell(prefix, r, c) {
  const text = (document.getElementById(prefix + r + '_' + c + '_text') || {}).value || '';
  const cspan = parseInt((document.getElementById(prefix + r + '_' + c + '_cspan') || {}).value, 10) || 0;
  const rspan = parseInt((document.getElementById(prefix + r + '_' + c + '_rspan') || {}).value, 10) || 0;
  return { text, cspan: Math.max(0, cspan), rspan: Math.max(0, rspan) };
}

function collectData() {
  const cols = state.columns;
  const hRows = state.headerRows;
  const bRows = state.bodyRows;

  const widths = [];
  for (let c = 0; c < cols; c++) {
    const el = document.getElementById('w' + c);
    widths.push(el ? Math.max(1, parseInt(el.value, 10) || 1) : 1);
  }

  const headerCells = [];
  for (let r = 0; r < hRows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(readCell('h', r, c));
    headerCells.push(row);
  }

  const bodyCells = [];
  for (let r = 0; r < bRows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(readCell('b', r, c));
    bodyCells.push(row);
  }

  return {
    columns: cols,
    headerRows: hRows,
    bodyRows: bRows,
    widths,
    headerCells,
    bodyCells,
    tableTitle: document.getElementById('tableTitle').value || ''
  };
}

function spanPrefix(cell) {
  let p = '';
  if (cell.cspan > 0) p += ':cspan:\`' + cell.cspan + '\` ';
  if (cell.rspan > 0) p += ':rspan:\`' + cell.rspan + '\` ';
  return p;
}

function buildRst(data) {
  const { columns, headerRows, bodyRows, widths, headerCells, bodyCells, tableTitle } = data;
  const lines = [];
  const titlePart = tableTitle.trim() ? ' ' + tableTitle.trim() : '';
  lines.push('.. flat-table::' + titlePart);
  if (headerRows > 0) lines.push('   :header-rows: ' + headerRows);
  lines.push('   :widths: ' + widths.join(' '));
  lines.push('');

  for (let r = 0; r < headerRows; r++) {
    const row = headerCells[r] || [];
    for (let c = 0; c < columns; c++) {
      const cell = row[c] || { text: '', cspan: 0, rspan: 0 };
      const text = cell.text.trim() || ('Заголовок ' + (c + 1));
      const p = spanPrefix(cell);
      lines.push(c === 0 ? '   * - ' + p + text : '     - ' + p + text);
    }
    lines.push('');
  }

  for (let r = 0; r < bodyRows; r++) {
    const row = bodyCells[r] || [];
    for (let c = 0; c < columns; c++) {
      const cell = row[c] || { text: '', cspan: 0, rspan: 0 };
      const p = spanPrefix(cell);
      lines.push(c === 0 ? '   * - ' + p + cell.text : '     - ' + p + cell.text);
    }
    lines.push('');
  }

  return lines.join('\\n');
}

function updatePreview() {
  const data = collectData();
  document.getElementById('preview').textContent = buildRst(data);
}

function insertTable() {
  const data = collectData();
  vscode.postMessage({ command: 'insert', data });
}

buildEditor();
</script>
</body>
</html>`;
}
