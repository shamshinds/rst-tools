import { DocLink } from './docTypes';

const DOC_ROLE_REGEX =
 /:doc:`([^`<]+?)(?:\s*<([^`>]+)>)?`/g;

export function parseDocLinks(text: string): DocLink[] {
 const result: DocLink[] = [];
 let match;

 while ((match = DOC_ROLE_REGEX.exec(text)) !== null) {
  const textOrPath = match[1].trim();
  const explicitPath = match[2]?.trim();

  result.push({
   raw: match[0],
   text: explicitPath ? textOrPath : undefined,
   target: explicitPath ?? textOrPath,
   rangeStart: match.index,
   rangeEnd: match.index + match[0].length
  });
 }

 return result;
}
