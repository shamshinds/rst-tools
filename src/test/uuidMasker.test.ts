import * as assert from 'assert';

import { findUuidMatches, maskUuid } from '../utils/uuidMasker';

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const MASKED = '550e8400-e29b-41d4-a716-4466********';

suite('uuidMasker: maskUuid', () => {

 test('маскирует последние 8 символов', () => {
  assert.strictEqual(maskUuid(UUID), MASKED);
 });

 test('длина строки не меняется', () => {
  assert.strictEqual(maskUuid(UUID).length, UUID.length);
 });

 test('регистр сохраненной части не меняется', () => {
  assert.strictEqual(
   maskUuid('550E8400-E29B-41D4-A716-446655440000'),
   '550E8400-E29B-41D4-A716-4466********'
  );
 });

 test('маскирует произвольное число символов', () => {
  assert.strictEqual(maskUuid(UUID, 4), '550e8400-e29b-41d4-a716-44665544****');
 });
});

suite('uuidMasker: findUuidMatches', () => {

 test('находит UUID в тексте и отдает смещения', () => {
  const text = `Идентификатор: ${UUID}.`;
  const matches = findUuidMatches(text);

  assert.strictEqual(matches.length, 1);
  assert.strictEqual(matches[0].original, UUID);
  assert.strictEqual(matches[0].masked, MASKED);
  assert.strictEqual(text.slice(matches[0].start, matches[0].end), UUID);
 });

 test('находит несколько UUID, в том числе в таблицах', () => {
  const text = [
   '   * - 550e8400-e29b-41d4-a716-446655440000',
   '     - 6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  ].join('\n');

  const matches = findUuidMatches(text);
  assert.strictEqual(matches.length, 2);
 });

 test('находит UUID в верхнем регистре', () => {
  const matches = findUuidMatches('ID 6BA7B810-9DAD-11D1-80B4-00C04FD430C8 здесь');
  assert.strictEqual(matches.length, 1);
 });

 test('повторный запуск ничего не находит — команда идемпотентна', () => {
  assert.deepStrictEqual(findUuidMatches(MASKED), []);
 });

 test('не трогает строки, похожие на UUID, но с другой разбивкой', () => {
  assert.deepStrictEqual(findUuidMatches('550e8400-e29b-41d4-a716-44665544000'), []);
  assert.deepStrictEqual(findUuidMatches('550e8400e29b41d4a716446655440000'), []);
 });

 test('не находит UUID внутри более длинной последовательности', () => {
  assert.deepStrictEqual(
   findUuidMatches('ff550e8400-e29b-41d4-a716-446655440000'),
   []
  );
 });

 test('пустой текст — пустой результат', () => {
  assert.deepStrictEqual(findUuidMatches(''), []);
 });

 test('смещения корректны для нескольких совпадений подряд', () => {
  const second = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  const text = `${UUID} и ${second}`;
  const matches = findUuidMatches(text);

  assert.strictEqual(matches.length, 2);
  assert.strictEqual(text.slice(matches[0].start, matches[0].end), UUID);
  assert.strictEqual(text.slice(matches[1].start, matches[1].end), second);
 });
});
