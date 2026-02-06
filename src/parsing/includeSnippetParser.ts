import { resolveRstPath } from '../utils/pathResolver';

export interface IncludeSnippetRef {
 includePathRaw: string;
 includeFileAbs: string;

 startAfter?: string;
 endBefore?: string;

 // ⬇️ ВАЖНО: координаты
 line: number;
 columnStart: number;
 columnEnd: number;
}

export function parseIncludeSnippets(
 text: string,
 docFilePath: string,
 confPath: string
): IncludeSnippetRef[] {
 const result: IncludeSnippetRef[] = [];

 const lines = text.split(/\r?\n/);

 for (let lineNo = 0; lineNo < lines.length; lineNo++) {
  const line = lines[lineNo];

  const m = /^\s*\.\.\s+include::\s+(.+)$/.exec(line);
  if (!m) continue;

  const includePathRaw = m[1].trim();

  let startAfter: string | undefined;
  let endBefore: string | undefined;

  // параметры include
  for (let i = lineNo + 1; i < lines.length; i++) {
   const l = lines[i];
   if (!/^[ \t]+:/.test(l)) break;

   const sa = /:start-after:\s*(.+)$/.exec(l);
   if (sa) startAfter = sa[1].trim();

   const eb = /:end-before:\s*(.+)$/.exec(l);
   if (eb) endBefore = eb[1].trim();
  }

  const includeFileAbs = resolveRstPath(
   includePathRaw,
   docFilePath,
   confPath
  );

  const columnStart = line.indexOf(includePathRaw);
  const columnEnd = columnStart + includePathRaw.length;

  result.push({
   includePathRaw,
   includeFileAbs,
   startAfter,
   endBefore,
   line: lineNo,
   columnStart,
   columnEnd
  });
 }

 return result;
}
