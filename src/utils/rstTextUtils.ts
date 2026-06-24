/**
 * Builds a Set of line numbers that fall inside RST literal/code blocks,
 * where the pipe character | is not an RST substitution reference.
 *
 * Handled block types:
 *   - ".. code-block::", ".. code::", ".. sourcecode::" directives
 *   - Literal blocks introduced by "::" at the end of a paragraph
 */
export function buildLiteralLineSet(text: string): Set<number> {
 const lines = text.split(/\r?\n/);
 const result = new Set<number>();

 const CODE_DIRECTIVE = /^(\s*)\.\.\s+(code-block|code|sourcecode)::/;

 let inBlock = false;
 let blockBaseIndent = 0;
 let awaitingContent = false;

 for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  const indent = (line.match(/^( *)/) ?? ['', ''])[1].length;

  if (inBlock) {
   if (trimmed === '') {
    result.add(i);
    continue;
   }
   if (indent > blockBaseIndent) {
    result.add(i);
    continue;
   }
   inBlock = false;
  }

  if (awaitingContent) {
   if (trimmed === '') continue;
   awaitingContent = false;
   if (indent > blockBaseIndent) {
    inBlock = true;
    result.add(i);
    continue;
   }
  }

  const codeMatch = CODE_DIRECTIVE.exec(line);
  if (codeMatch) {
   blockBaseIndent = codeMatch[1].length;
   awaitingContent = true;
   continue;
  }

  // Literal block: regular text paragraph ending with "::" or standalone "::".
  // Строки вида ".. directive::" — это RST-директивы, а не маркеры литерального блока,
  // поэтому их намеренно исключаем.
  if (!trimmed.startsWith('..') && (trimmed === '::' || trimmed.endsWith('::'))) {
   blockBaseIndent = indent;
   awaitingContent = true;
  }
 }

 return result;
}
