import { resolveRstPath } from '../utils/pathResolver';

export interface IncludeSnippetRef {
 includePathRaw: string;
 includeFileAbs: string;

 startAfter?: string;
 endBefore?: string;

 rangeStartOffset: number;
 rangeEndOffset: number;
}

export function parseIncludeSnippets(
 text: string,
 docFilePath: string,
 confPath: string
): IncludeSnippetRef[] {
 const result: IncludeSnippetRef[] = [];

 // include:: <path>
 //   :start-after: ...
 //   :end-before: ...
 const re =
  /^\s*\.\.\s+include::\s+([^\r\n]+)\s*(?:\r?\n((?:[ \t]+:[^\r\n]*\r?\n?)*))?/gm;

 let m: RegExpExecArray | null;

 while ((m = re.exec(text)) !== null) {
  const includePathRaw = (m[1] ?? '').trim();
  const paramsBlock = m[2] ?? '';

  const sa = /:start-after:\s*([^\r\n]+)\s*$/m.exec(paramsBlock);
  const eb = /:end-before:\s*([^\r\n]+)\s*$/m.exec(paramsBlock);

  const startAfter = sa ? (sa[1] ?? '').trim() : undefined;
  const endBefore = eb ? (eb[1] ?? '').trim() : undefined;

  // ✅ FIX: include path может быть относительным или от conf.py
  const includeFileAbs = resolveRstPath(includePathRaw, docFilePath, confPath);

  const blockText = m[0];

  result.push({
   includePathRaw,
   includeFileAbs,
   startAfter,
   endBefore,
   rangeStartOffset: m.index,
   rangeEndOffset: m.index + blockText.length
  });
 }

 return result;
}
