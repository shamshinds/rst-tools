/**
 * Поиск и маскирование идентификаторов UUID.
 *
 * Маскируются последние символы: 550e8400-e29b-41d4-a716-446655440000
 * превращается в 550e8400-e29b-41d4-a716-4466********. Длина строки
 * сохраняется, поэтому разметка таблиц и выравнивание не разъезжаются.
 */

/** Канонический вид UUID: 8-4-4-4-12 шестнадцатеричных символов. */
const UUID_SOURCE = '\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b';

export const DEFAULT_MASKED_TAIL = 8;
export const MASK_CHAR = '*';

export interface UuidMatch {
 /** Смещение начала UUID от начала текста. */
 start: number;
 /** Смещение конца UUID (не включая). */
 end: number;
 original: string;
 masked: string;
}

/**
 * Заменяет последние `tail` символов на звездочки.
 * Регистр сохраненной части не меняется.
 */
export function maskUuid(uuid: string, tail: number = DEFAULT_MASKED_TAIL): string {
 if (tail <= 0) return uuid;
 if (tail >= uuid.length) return MASK_CHAR.repeat(uuid.length);

 return uuid.slice(0, uuid.length - tail) + MASK_CHAR.repeat(tail);
}

/**
 * Находит все UUID в тексте. Уже замаскированные не находятся:
 * звездочка не шестнадцатеричный символ, поэтому повторный запуск
 * команды ничего не портит.
 */
export function findUuidMatches(
 text: string,
 tail: number = DEFAULT_MASKED_TAIL
): UuidMatch[] {
 const regex = new RegExp(UUID_SOURCE, 'gi');
 const result: UuidMatch[] = [];

 let match: RegExpExecArray | null;

 while ((match = regex.exec(text)) !== null) {
  const original = match[0];
  const masked = maskUuid(original, tail);

  // Уже замаскированные сюда не попадут, но на случай tail <= 0
  // не создаем правку, которая ничего не меняет.
  if (masked === original) continue;

  result.push({
   start: match.index,
   end: match.index + original.length,
   original,
   masked
  });
 }

 return result;
}
