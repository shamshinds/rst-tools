import { RstVariable } from '../variables/variableTypes';

const VAR_DEF_REGEX =
 /^\.\.\s+\|([^|]+)\|\s+replace::\s+(.+)$/gm;

export function extractVariables(
 content: string,
 source: string
): Map<string, RstVariable> {

 const map = new Map<string, RstVariable>();
 let match;

 while ((match = VAR_DEF_REGEX.exec(content)) !== null) {
  map.set(match[1], {
   name: match[1],
   value: match[2],
   source
  });
 }

 return map;
}
