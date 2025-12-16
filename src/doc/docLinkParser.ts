const DOC_LINK_REGEX = /:doc:`([^`]+)`/g;

export function extractDocLinks(text: string): string[] {
 const result: string[] = [];
 let m;
 while ((m = DOC_LINK_REGEX.exec(text)) !== null) {
  result.push(m[1]);
 }
 return result;
}
