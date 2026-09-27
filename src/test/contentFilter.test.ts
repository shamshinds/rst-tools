import * as assert from 'assert';

import {
 filterRstContent,
 collectTags,
 applyFilterRole,
 ALL_TAG,
 LIST_BREAK_COMMENT
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

suite('contentFilter: only внутри пункта списка', () => {

 const ITEM = lines(
  '#. ',
  '   .. only:: public',
  '   ',
  '      Четвертый пункт паблик.',
  '      Еще предложение.',
  '',
  '   .. only:: private',
  '      ',
  '      Четвертый пункт приват',
  '',
  '#. Следующий пункт'
 );

 test('текст подтягивается на строку маркера, продолжение выравнивается по тексту', () => {
  assert.strictEqual(
   filterRstContent(ITEM, 'public'),
   lines(
    '#. Четвертый пункт паблик.',
    '   Еще предложение.',
    '',
    '#. Следующий пункт'
   )
  );
 });

 test('подтягивается и блок, который идет вторым после выброшенного', () => {
  assert.strictEqual(
   filterRstContent(ITEM, 'private'),
   lines('#. Четвертый пункт приват', '', '#. Следующий пункт')
  );
 });

 test('пункт с текстом на строке маркера не трогается', () => {
  const source = lines(
   '#. Текст пункта',
   '',
   '   .. only:: public',
   '',
   '      Дополнение',
   ''
  );

  assert.strictEqual(
   filterRstContent(source, 'public'),
   lines('#. Текст пункта', '', '   Дополнение', '')
  );
 });

 test('директиву на строку маркера не подтягиваем', () => {
  const source = lines(
   '#. ',
   '   .. only:: public',
   '',
   '      .. code-block:: bash',
   '',
   '         echo hi'
  );

  assert.strictEqual(
   filterRstContent(source, 'public'),
   lines('#. ', '   .. code-block:: bash', '', '      echo hi')
  );
 });

 test('маркеры других видов тоже работают', () => {
  const source = lines('- ', '  .. only:: public', '', '     текст');
  assert.strictEqual(filterRstContent(source, 'public'), '- текст');

  const numbered = lines('12. ', '    .. only:: public', '', '       текст', '       дальше');
  assert.strictEqual(filterRstContent(numbered, 'public'), lines('12. текст', '    дальше'));
 });

 test('если ничего не подошло, пустой маркер остается как есть', () => {
  assert.strictEqual(
   filterRstContent(ITEM, 'draft'),
   lines('#. ', '', '#. Следующий пункт')
  );
 });
});

suite('contentFilter: only обрывает список', () => {

 const LIST = lines(
  '#. Четвертый пункт',
  '',
  '.. only:: public',
  '   ',
  '   #. Пятый пункт паблик',
  '',
  '#. Шестой пункт.'
 );

 test('пункт внутри only отделяется пометками с обеих сторон', () => {
  assert.strictEqual(
   filterRstContent(LIST, 'public'),
   lines(
    '#. Четвертый пункт',
    '',
    LIST_BREAK_COMMENT,
    '',
    '#. Пятый пункт паблик',
    '',
    LIST_BREAK_COMMENT,
    '',
    '#. Шестой пункт.'
   )
  );
 });

 test('выброшенный only между пунктами тоже разрывает список', () => {
  assert.strictEqual(
   filterRstContent(LIST, 'private'),
   lines('#. Четвертый пункт', '', LIST_BREAK_COMMENT, '', '#. Шестой пункт.')
  );
 });

 test('два only подряд между пунктами дают разрыв на каждой границе', () => {
  const source = lines(
   '#. Раз',
   '',
   '.. only:: public',
   '',
   '   #. Два паблик',
   '',
   '.. only:: private',
   '',
   '   #. Два приват',
   '',
   '#. Три'
  );

  assert.strictEqual(
   filterRstContent(source, 'public'),
   lines(
    '#. Раз', '', LIST_BREAK_COMMENT, '', '#. Два паблик',
    '', LIST_BREAK_COMMENT, '', '#. Три'
   )
  );
 });

 test('only между абзацами пометку не добавляет', () => {
  const source = lines('Абзац', '', '.. only:: public', '', '   Текст', '', 'Абзац');
  assert.ok(!filterRstContent(source, 'public').includes(LIST_BREAK_COMMENT));
  assert.ok(!filterRstContent(source, 'private').includes(LIST_BREAK_COMMENT));
 });

 test('only внутри пункта не разрывает внешний список', () => {
  const source = lines(
   '#. Раз',
   '',
   '   .. only:: public',
   '',
   '      Уточнение',
   '',
   '#. Два'
  );

  assert.ok(!filterRstContent(source, 'public').includes(LIST_BREAK_COMMENT));
  assert.ok(!filterRstContent(source, 'private').includes(LIST_BREAK_COMMENT));
 });

 test('пометка — это комментарий RST, а не директива', () => {
  assert.ok(LIST_BREAK_COMMENT.startsWith('.. '));
  assert.ok(!LIST_BREAK_COMMENT.includes('::'), 'иначе RST примет ее за директиву');
 });
});

suite('contentFilter: знаки препинания после удаленной роли', () => {

 test('пробел перед точкой после удаленной роли убирается', () => {
  assert.strictEqual(
   applyFilterRole('собака :filter:`<public> бобик` :filter:`<private> шарик`.', 'public'),
   'собака бобик.'
  );
 });

 test('пробел перед запятой тоже', () => {
  assert.strictEqual(
   applyFilterRole('Кот :filter:`<private> Мурзик`, привет', 'public'),
   'Кот, привет'
  );
 });

 test('в строке без удаленных ролей пробел перед знаком не трогаем', () => {
  assert.strictEqual(
   applyFilterRole('текст :filter:`<public> слово` ; так и было', 'public'),
   'текст слово ; так и было'
  );
 });
});
