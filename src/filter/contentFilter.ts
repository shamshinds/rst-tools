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

 body = body.replace(FILTER_RE, (_whole, declared: string, content: string) =>
  tagMatches(declared, tag) ? content.trim() : ''
 );

 body = body.replace(/[ \t]{2,}/g, ' ').trim();

 return body ? indent + body : '';
}

interface Context {
 tag: string;
 /** Общий для всех уровней вложенности накопитель результата. */
 out: string[];
 /** Только что выброшен блок — следующая пустая строка может быть лишней. */
 droppedBlock: boolean;
}

/**
 * Добавляет строку, не допуская пустых строк подряд там, где блок выброшен.
 * Иначе на месте каждого удаленного блока оставалась бы лишняя пустая строка.
 */
function pushLine(ctx: Context, line: string) {
 if (isBlank(line)) {
  const last = ctx.out[ctx.out.length - 1];
  if (ctx.droppedBlock && (ctx.out.length === 0 || isBlank(last))) return;
  ctx.out.push(line);
  return;
 }

 ctx.droppedBlock = false;
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

  if (tagMatches(declared, tag)) {
   const before = ctx.out.length;

   // Вложенные only обрабатываем тем же кодом.
   processLines(dedentTo(body, directiveIndent), ctx);

   // Блок подошел по тегу, но ничего не дал — пустой или все содержимое
   // отфильтровано изнутри. Для отбивки это то же самое, что выброшенный блок.
   if (ctx.out.length === before) {
    ctx.droppedBlock = true;
   }
  } else {
   ctx.droppedBlock = true;
  }

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
 const ctx: Context = { tag, out: [], droppedBlock: false };

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
