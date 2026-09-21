import * as assert from 'assert';
import * as path from 'path';

import { parseDocsUrl, buildRelativeDocPath, wrapInDocRole } from '../doc/urlToDoc';

const BASE = ['https://cloud.ru/docs/'];

suite('urlToDoc: parseDocsUrl', () => {

 test('разбирает URL с query-параметрами', () => {
  const parts = parseDocsUrl(
   'https://cloud.ru/docs/virtual-machines/ug/topics/guides__power-on?source-platform=Evolution',
   BASE
  );

  assert.deepStrictEqual(parts, {
   projectName: 'virtual-machines',
   section: 'ug',
   docPath: 'topics/guides__power-on',
   projectId: 'virtual-machines__ug'
  });
 });

 test('отбрасывает якорь и завершающий слеш', () => {
  const parts = parseDocsUrl(
   'https://cloud.ru/docs/project-1/ag/topics/intro/#section',
   BASE
  );

  assert.strictEqual(parts?.projectId, 'project-1__ag');
  assert.strictEqual(parts?.docPath, 'topics/intro');
 });

 test('отбрасывает расширение .html', () => {
  const parts = parseDocsUrl('https://cloud.ru/docs/zero/ug/topics/start.html', BASE);
  assert.strictEqual(parts?.docPath, 'topics/start');
 });

 test('не зависит от схемы, www и регистра хоста', () => {
  const parts = parseDocsUrl('http://WWW.Cloud.ru/docs/zero/ug/topics/start', BASE);
  assert.strictEqual(parts?.projectId, 'zero__ug');
 });

 test('сохраняет регистр пути к документу', () => {
  const parts = parseDocsUrl('https://cloud.ru/docs/zero/ug/Topics/Start', BASE);
  assert.strictEqual(parts?.docPath, 'Topics/Start');
 });

 test('поддерживает вложенные пути', () => {
  const parts = parseDocsUrl('https://cloud.ru/docs/zero/ug/a/b/c/d', BASE);
  assert.strictEqual(parts?.docPath, 'a/b/c/d');
 });

 test('возвращает null для чужого домена', () => {
  assert.strictEqual(
   parseDocsUrl('https://example.com/docs/zero/ug/topics/start', BASE),
   null
  );
 });

 test('разделом может быть любая подпапка, не только ug и ag', () => {
  const parts = parseDocsUrl('https://cloud.ru/docs/folder/overview/index', BASE);
  assert.strictEqual(parts?.projectId, 'folder__overview');
  assert.strictEqual(parts?.docPath, 'index');
 });

 test('сохраняет регистр раздела — это имя каталога на диске', () => {
  const parts = parseDocsUrl('https://cloud.ru/docs/zero/Overview/topics/start', BASE);
  assert.strictEqual(parts?.section, 'Overview');
  assert.strictEqual(parts?.projectId, 'zero__Overview');
 });

 test('возвращает null, если пути к документу нет', () => {
  assert.strictEqual(parseDocsUrl('https://cloud.ru/docs/zero/ug', BASE), null);
  assert.strictEqual(parseDocsUrl('https://cloud.ru/docs/zero/ug/', BASE), null);
 });

 test('возвращает null для мусора', () => {
  assert.strictEqual(parseDocsUrl('', BASE), null);
  assert.strictEqual(parseDocsUrl('   ', BASE), null);
  assert.strictEqual(parseDocsUrl('https://cloud.ru/docs/', BASE), null);
 });

 test('учитывает несколько базовых адресов', () => {
  const bases = ['https://cloud.ru/docs/', 'https://docs.internal/'];
  const parts = parseDocsUrl('https://docs.internal/project-2/ag/topics/x', bases);
  assert.strictEqual(parts?.projectId, 'project-2__ag');
 });

 test('пустой список базовых адресов ничего не разбирает', () => {
  assert.strictEqual(
   parseDocsUrl('https://cloud.ru/docs/zero/ug/topics/start', []),
   null
  );
 });
});

suite('urlToDoc: buildRelativeDocPath', () => {

 const root = path.join('C:', 'docs', 'zero', 'ug');

 test('путь к соседнему каталогу считается от файла', () => {
  const result = buildRelativeDocPath(
   root,
   'topics/guides__power-on',
   path.join(root, 'main.rst')
  );

  assert.strictEqual(result, 'topics/guides__power-on');
 });

 test('выход вверх по дереву дает ../', () => {
  const result = buildRelativeDocPath(
   root,
   'topics/target',
   path.join(root, 'other', 'source.rst')
  );

  assert.strictEqual(result, '../topics/target');
 });

 test('разделители всегда POSIX', () => {
  const result = buildRelativeDocPath(
   root,
   'a/b/c',
   path.join(root, 'x', 'y', 'source.rst')
  );

  assert.ok(!result.includes('\\'), `ожидались POSIX-разделители, получено: ${result}`);
  assert.strictEqual(result, '../../a/b/c');
 });
});

suite('urlToDoc: wrapInDocRole', () => {

 test('оборачивает путь в роль', () => {
  assert.strictEqual(
   wrapInDocRole('virtual-machines__ug:topics/guides__power-on'),
   ':doc:`virtual-machines__ug:topics/guides__power-on`'
  );
 });
});
