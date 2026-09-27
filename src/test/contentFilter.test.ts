import * as assert from 'assert';

import {
 filterRstContent,
 collectTags,
 applyFilterRole,
 ALL_TAG
} from '../filter/contentFilter';

/** Собирает текст из строк — чтобы отступы в тестах были видны явно. */
function lines(...rows: string[]): string {
 return rows.join('\n');
}

suite('contentFilter: директива only', () => {

 const SOURCE = lines(
  'Заголовок',
  '=========',
  '',
  '.. only:: public',
  '   ',
  '   Текст для паблика',
  '',
  '.. only:: private',
  '   ',
  '   Текст для привата',
  '',
  'Общий текст'
 );

 test('public оставляет свой блок и убирает директиву с отступом', () => {
  assert.strictEqual(
   filterRstContent(SOURCE, 'public'),
   lines('Заголовок', '=========', '', 'Текст для паблика', '', 'Общий текст')
  );
 });

 test('private оставляет свой блок', () => {
  assert.strictEqual(
   filterRstContent(SOURCE, 'private'),
   lines('Заголовок', '=========', '', 'Текст для привата', '', 'Общий текст')
  );
 });

 test('all возвращает текст без единого изменения', () => {
  assert.strictEqual(filterRstContent(SOURCE, ALL_TAG), SOURCE);
 });

 test('неизвестный тег убирает все отфильтрованное, общий текст остается', () => {
  assert.strictEqual(
   filterRstContent(SOURCE, 'draft'),
   lines('Заголовок', '=========', '', 'Общий текст')
  );
 });

 test('содержимое блока не склеивается со следующим абзацем', () => {
  const out = filterRstContent(SOURCE, 'public');
  assert.ok(
   out.includes('Текст для паблика\n\nОбщий текст'),
   `ожидалась пустая строка между абзацами, получено:\n${out}`
  );
 });
});

suite('contentFilter: отступы и вложенность', () => {

 test('блок внутри списка сохраняет отступ списка', () => {
  const source = lines(
   '- пункт:',
   '',
   '  .. only:: public',
   '',
   '     вложенный текст',
   '',
   '- следующий пункт'
  );

  assert.strictEqual(
   filterRstContent(source, 'public'),
   lines('- пункт:', '', '  вложенный текст', '', '- следующий пункт')
  );
 });

 test('вложенные only обрабатываются рекурсивно', () => {
  const source = lines(
   '.. only:: public',
   '',
   '   виден в паблике',
   '',
   '   .. only:: private',
   '',
   '      только для привата',
   '',
   'конец'
  );

  assert.strictEqual(
   filterRstContent(source, 'public'),
   lines('виден в паблике', '', 'конец')
  );
 });

 test('многострочное содержимое сохраняет внутренние отступы', () => {
  const source = lines(
   '.. only:: public',
   '',
   '   .. code-block:: bash',
   '',
   '      echo hi',
   '',
   'конец'
  );

  assert.strictEqual(
   filterRstContent(source, 'public'),
   lines('.. code-block:: bash', '', '   echo hi', '', 'конец')
  );
 });

 test('пустой блок не оставляет мусора', () => {
  const source = lines('до', '', '.. only:: public', '', 'после');

  assert.strictEqual(filterRstContent(source, 'public'), lines('до', '', 'после'));
  assert.strictEqual(filterRstContent(source, 'private'), lines('до', '', 'после'));
 });
});

suite('contentFilter: роль filter', () => {

 const ROLES = ':filter:`<public> для паблика` :filter:`<private> для привата`';

 test('оставляет текст подходящей роли и убирает остальные', () => {
  assert.strictEqual(applyFilterRole(ROLES, 'public'), 'для паблика');
  assert.strictEqual(applyFilterRole(ROLES, 'private'), 'для привата');
 });

 test('роль внутри предложения разворачивается по месту', () => {
  assert.strictEqual(
   applyFilterRole('Начало :filter:`<public> середина` конец', 'public'),
   'Начало середина конец'
  );
 });

 test('неподходящая роль не оставляет двойных пробелов', () => {
  assert.strictEqual(
   applyFilterRole('Начало :filter:`<private> середина` конец', 'public'),
   'Начало конец'
  );
 });

 test('отступ строки сохраняется', () => {
  assert.strictEqual(
   applyFilterRole('   :filter:`<public> текст`', 'public'),
   '   текст'
  );
 });

 test('строка целиком из неподходящих ролей становится пустой', () => {
  assert.strictEqual(applyFilterRole(':filter:`<private> текст`', 'public'), '');
 });

 test('строка без ролей не меняется', () => {
  const line = '   обычный   текст  с   пробелами';
  assert.strictEqual(applyFilterRole(line, 'public'), line);
 });

 test('роли обрабатываются и через filterRstContent', () => {
  assert.strictEqual(filterRstContent(ROLES, 'public'), 'для паблика');
  assert.strictEqual(filterRstContent(ROLES, ALL_TAG), ROLES);
 });
});

suite('contentFilter: выражения и переносы строк', () => {

 test('выражение в only оставляется как есть — вычислять его нечем', () => {
  const source = lines('.. only:: public and not draft', '', '   текст', '', 'конец');
  const out = filterRstContent(source, 'public');

  assert.ok(out.includes('.. only:: public and not draft'), out);
  assert.ok(out.includes('текст'), out);
 });

 test('CRLF сохраняется', () => {
  const source = '.. only:: public\r\n\r\n   текст\r\n\r\nконец';
  const out = filterRstContent(source, 'public');

  assert.strictEqual(out, 'текст\r\n\r\nконец');
  assert.ok(!out.includes('\n\n'.replace(/\n/g, '\u0000')), 'CRLF не должен стать LF');
 });

 test('текст без конструкций не меняется ни при каком теге', () => {
  const source = lines('Просто', '', 'текст');
  assert.strictEqual(filterRstContent(source, 'public'), source);
  assert.strictEqual(filterRstContent(source, ALL_TAG), source);
 });
});

suite('contentFilter: collectTags', () => {

 test('собирает теги из only и из ролей', () => {
  const source = lines(
   '.. only:: public',
   '',
   '   текст',
   '',
   ':filter:`<private> строка` :filter:`<beta> строка`'
  );

  assert.deepStrictEqual(collectTags(source), ['beta', 'private', 'public']);
 });

 test('дубликаты не повторяются', () => {
  const source = lines('.. only:: public', '', '   a', '', '.. only:: public', '', '   b');
  assert.deepStrictEqual(collectTags(source), ['public']);
 });

 test('выражения не попадают в список тегов', () => {
  assert.deepStrictEqual(collectTags('.. only:: public and not draft'), []);
 });

 test('текст без конструкций дает пустой список', () => {
  assert.deepStrictEqual(collectTags(lines('Просто', 'текст')), []);
 });
});
