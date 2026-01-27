import { RstVariable } from '../variables/variableTypes';

const VAR_TEXT = /^\s*\.\.\s+\|(.+?)\|\s+replace::\s+(.+)$/gm;
const VAR_IMAGE = /^\s*\.\.\s+\|(.+?)\|\s+\.\.\s+image::\s+(.+)$/gm;

export function extractVariables(text: string, file: string): Map<string, RstVariable> {
 const vars = new Map<string, RstVariable>();

 let m;

 // Текстовые
 while ((m = VAR_TEXT.exec(text)) !== null) {
  vars.set(m[1], {
   name: m[1],
   value: m[2].trim(),
   kind: 'text',
   source: file
  });
 }

 // Картинки
 while ((m = VAR_IMAGE.exec(text)) !== null) {
  vars.set(m[1], {
   name: m[1],
   kind: 'image',
   source: file,
   imagePath: m[2].trim()
  });
 }

 return vars;
}
