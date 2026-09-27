/**
 * Фильтрация содержимого RST по тегу версии документа.
 *
 * Отвечают две конструкции:
 *
 *   .. only:: public          — блочная директива
 *
 *      Текст для паблика
 *
 *   :filter:`<public> текст`  — инлайновая роль
 *
 * При выборе тега остается только содержимое подходящих конструкций, сами
 * конструкции убираются: строка директивы удаляется, отступ содержимого
 * снимается, роль заменяется своим текстом. Неподходящие конструкции
 * удаляются целиком вместе с содержимым. Все остальное не меняется.
 */

/** Тег, при котором файл показывается в исходном виде. */
export const ALL_TAG = 'all';

/** `.. only:: тег` — с любым отступом. */
const ONLY_RE = /^([ \t]*)\.\.[ \t]+only::[ \t]*(.*)$/;

/** :filter:`<тег> текст` */
const FILTER_RE = /:filter:`<([^>]*)>[ \t]?([^`]*)`/g;

/** Голое имя тега: выражения вида `public and not draft` не поддерживаются. */
const BARE_TAG_RE = /^[A-Za-z0-9_-]+$/;

/**
 * Маркер пункта списка: `#.`, `1.`, `a.`, `iv.`, `(1)`, `1)`, `-`, `*`, `+`.
 * После маркера обязателен пробел или конец строки, поэтому подчеркивание
 * заголовка `-----` и `..` за маркер не принимаются.
 */
const LIST_MARKER_RE =
 /^([ \t]*)(?:[-*+•]|\(?(?:#|\d+|[A-Za-z]|[ivxlcdmIVXLCDM]+)[.)])(?=[ \t]|$)/;

/**
 * Пометка на месте, где директива `only` обрывает список.
 * Это комментарий RST: при сборке он не виден, но сам тоже разделяет
 * списки, так что предпросмотр ведет себя так же, как настоящая сборка.
 */
export const LIST_BREAK_COMMENT =
 '.. rst-tools: список прерван директивой only, дальше Sphinx начнет новый список';

function isBlank(line: string): boolean {
 return line.trim() === '';
}

function indentWidth(line: string): number {
 return (/^[ \t]*/.exec(line) ?? [''])[0].length;
}

/** Сравнение тегов точное: Sphinx различает регистр. */
function tagMatches(declared: string, selected: string): boolean {
 return declared.trim() === selected.trim();
}

/**
 * Снимает у блока отступ так, чтобы содержимое встало на уровень директивы.
 * Пустые строки превращаются в действительно пустые.
 */
function dedentTo(lines: string[], targetIndent: number): string[] {
 const widths = lines.filter(l => !isBlank(l)).map(indentWidth);
 if (widths.length === 0) return lines.map(() => '');

 const shift = Math.max(0, Math.min(...widths) - targetIndent);

 return lines.map(line => (isBlank(line) ? '' : line.slice(shift)));
}

/**
 * Разворачивает или убирает инлайновые роли `:filter:` в одной строке.
 *
 * Отступ строки сохраняется, а внутри — двойные пробелы, оставшиеся после
 * удаления роли, сворачиваются. Если от строки ничего не осталось,
 * возвращается пустая строка.
 */
export function applyFilterRole(line: string, tag: string): string {
 if (!line.includes(':filter:`')) return line;

 const indent = (/^[ \t]*/.exec(line) ?? [''])[0];
 let body = line.slice(indent.length);

 // На месте удаленной роли ставим метку, чтобы потом убрать пробел перед
 // знаком препинания только там, а не во всей строке.
 const GAP = '\u0000';

 body = body.replace(FILTER_RE, (_whole, declared: string, content: string) =>
  tagMatches(declared, tag) ? content.trim() : GAP
 );

 body = body
  .replace(/[ \t]*\u0000[ \t]*(?=[.,;:!?)\]»])/g, '')
  .replace(/\u0000/g, '')
  .replace(/[ \t]{2,}/g, ' ')
  .trim();

 return body ? indent + body : '';
}

interface ListMarker {
 indent: number;
 /** Колонка, с которой начинается текст пункта. */
 textCol: number;
 /** На строке только маркер — текст пункта идет следующими строками. */
 empty: boolean;
}

function listMarker(line: string | undefined): ListMarker | null {
 if (line === undefined) return null;

 const m = LIST_MARKER_RE.exec(line);
 if (!m) return null;

 return {
  indent: m[1].length,
  textCol: m[0].length + 1,
  empty: line.slice(m[0].length).trim() === ''
 };
}

function isItemAt(line: string | undefined, indent: number): boolean {
 return listMarker(line)?.indent === indent;
}

interface Context {
 tag: string;
 /** Общий для всех уровней вложенности накопитель результата. */
 out: string[];
 /** Только что выброшен блок — следующая пустая строка может быть лишней. */
 droppedBlock: boolean;
 /** Последний пустой маркер пункта (`#. `), в который можно подтянуть текст. */
 emptyMarker: { index: number; indent: number; textCol: number } | null;
 /** Индекс строки маркера, в которую подтянуть первую строку содержимого. */
 hoistInto: number | null;
 /** Отступ, на котором директива only оборвала список. */
 boundaryAt: number | null;
}

/** Последняя непустая строка результата с отступом не больше заданного. */
function lastSignificant(ctx: Context, maxIndent: number): string | undefined {
 for (let k = ctx.out.length - 1; k >= 0; k--) {
  const line = ctx.out[k];
  if (!isBlank(line) && indentWidth(line) <= maxIndent) return line;
 }
 return undefined;
}

function emitListBreak(ctx: Context, indent: number) {
 const last = ctx.out[ctx.out.length - 1];
 if (ctx.out.length > 0 && !isBlank(last)) ctx.out.push('');

 ctx.out.push(' '.repeat(indent) + LIST_BREAK_COMMENT);
 ctx.out.push('');
}

/**
 * На строку маркера можно подтянуть только обычный текст: директиву или
 * вложенный список лучше оставить на своей строке.
 */
function canHoist(line: string): boolean {
 return !line.trimStart().startsWith('..') && listMarker(line) === null;
}

/**
 * Добавляет строку в результат.
 *
 * Здесь же три поправки на то, как выглядит документ после фильтрации:
 * - пустые строки не копятся подряд там, где блок выброшен;
 * - первая строка содержимого only подтягивается на строку пустого маркера;
 * - если only оборвал список, а после него снова пункт на том же уровне,
 *   вставляется пометка о разрыве — иначе два списка выглядели бы одним.
 */
function pushLine(ctx: Context, line: string) {
 if (isBlank(line)) {
  // Между пустым маркером и подтягиваемым текстом пустые строки не нужны.
  if (ctx.hoistInto !== null) return;

  const last = ctx.out[ctx.out.length - 1];
  if (ctx.droppedBlock && (ctx.out.length === 0 || isBlank(last))) return;
  ctx.out.push(line);
  return;
 }

 if (ctx.hoistInto !== null) {
  const target = ctx.hoistInto;
  ctx.hoistInto = null;

  if (canHoist(line)) {
   // Отбрасываем пустые строки, накопившиеся после маркера.
   ctx.out.length = target + 1;
   ctx.out[target] = ctx.out[target].trimEnd() + ' ' + line.trimStart();
   ctx.emptyMarker = null;
   ctx.boundaryAt = null;
   ctx.droppedBlock = false;
   return;
  }
 }

 if (ctx.boundaryAt !== null && indentWidth(line) <= ctx.boundaryAt) {
  const at = ctx.boundaryAt;
  if (isItemAt(line, at) && isItemAt(lastSignificant(ctx, at), at)) {
   emitListBreak(ctx, at);
  }
  ctx.boundaryAt = null;
 }

 ctx.droppedBlock = false;

 const marker = listMarker(line);
 ctx.emptyMarker = marker?.empty
  ? { index: ctx.out.length, indent: marker.indent, textCol: marker.textCol }
  : null;

 ctx.out.push(line);
}

/**
 * Обрабатывает строки, дописывая результат в общий накопитель.
 *
 * Важно, что накопитель и состояние общие: если возвращать результат
 * вложенного вызова наружу и проталкивать его заново, отметка о выброшенном
 * блоке сбрасывается не в том порядке и появляются лишние пустые строки.
 */
function processLines(lines: string[], ctx: Context) {
 const tag = ctx.tag;
 let i = 0;

 while (i < lines.length) {
  const match = ONLY_RE.exec(lines[i]);

  if (!match) {
   pushLine(ctx, applyFilterRole(lines[i], tag));
   i++;
   continue;
  }

  const directiveIndent = match[1].length;
  const declared = match[2].trim();

  // Выражения (`public and not draft`) не вычисляем — оставляем блок как есть,
  // чтобы автор видел необработанный участок, а не пустоту вместо него.
  if (!BARE_TAG_RE.test(declared)) {
   pushLine(ctx, lines[i]);
   i++;
   continue;
  }

  // Тело блока: строки с отступом больше, чем у директивы, плюс пустые строки.
  const body: string[] = [];
  let j = i + 1;

  while (j < lines.length) {
   const line = lines[j];
   if (isBlank(line) || indentWidth(line) > directiveIndent) {
    body.push(line);
    j++;
    continue;
   }
   break;
  }

  // Замыкающие пустые строки принадлежат не блоку, а разделению блоков:
  // возвращаем их в общий поток, чтобы разметка не склеилась.
  while (body.length > 0 && isBlank(body[body.length - 1])) {
   body.pop();
   j--;
  }

  // Ведущие пустые строки — это отбивка между директивой и содержимым.
  while (body.length > 0 && isBlank(body[0])) {
   body.shift();
  }

  // Директива only — отдельный узел документа: она обрывает список, в котором
  // стоит на одном уровне с пунктами. Отмечаем границу до и после блока.
  ctx.boundaryAt = directiveIndent;

  if (tagMatches(declared, tag)) {
   const before = ctx.out.length;

   // only внутри пункта с пустым маркером (`#. `): текст встанет на строку
   // маркера, а продолжение выравнивается по началу текста пункта.
   const marker = ctx.emptyMarker;
   const hoist = marker !== null && directiveIndent > marker.indent;
   const target = hoist ? marker.textCol : directiveIndent;

   if (hoist) ctx.hoistInto = marker.index;

   // Вложенные only обрабатываем тем же кодом.
   processLines(dedentTo(body, target), ctx);

   ctx.hoistInto = null;

   // Блок подошел по тегу, но ничего не дал — пустой или все содержимое
   // отфильтровано изнутри. Для отбивки это то же самое, что выброшенный блок.
   if (ctx.out.length === before) {
    ctx.droppedBlock = true;
   }
  } else {
   ctx.droppedBlock = true;
  }

  ctx.boundaryAt = directiveIndent;
  i = j;
 }
}

/**
 * Возвращает содержимое файла, отфильтрованное по тегу.
 * Для тега `all` текст возвращается без изменений.
 */
export function filterRstContent(text: string, tag: string): string {
 if (tag === ALL_TAG) return text;

 const eol = text.includes('\r\n') ? '\r\n' : '\n';
 const ctx: Context = {
  tag,
  out: [],
  droppedBlock: false,
  emptyMarker: null,
  hoistInto: null,
  boundaryAt: null
 };

 processLines(text.split(/\r?\n/), ctx);

 return ctx.out.join(eol);
}

/**
 * Теги, встречающиеся в тексте: из директив `only` и ролей `:filter:`.
 * Выражения пропускаются — вычислять их расширение не умеет.
 */
export function collectTags(text: string): string[] {
 const tags = new Set<string>();

 for (const line of text.split(/\r?\n/)) {
  const only = ONLY_RE.exec(line);
  if (only) {
   const declared = only[2].trim();
   if (BARE_TAG_RE.test(declared)) tags.add(declared);
  }

  FILTER_RE.lastIndex = 0;
  let role: RegExpExecArray | null;
  while ((role = FILTER_RE.exec(line)) !== null) {
   const declared = role[1].trim();
   if (BARE_TAG_RE.test(declared)) tags.add(declared);
  }
 }

 return [...tags].sort((a, b) => a.localeCompare(b));
}
