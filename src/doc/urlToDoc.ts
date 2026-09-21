import * as path from 'path';

/**
 * Разбор URL документации в составные части ссылки `:doc:`.
 *
 * https://cloud.ru/docs/virtual-machines/ug/topics/guides__power-on?source-platform=Evolution
 *   → projectName "virtual-machines", section "ug",
 *     docPath "topics/guides__power-on", projectId "virtual-machines__ug"
 */
export interface DocUrlParts {
 projectName: string;
 section: string;
 docPath: string;
 projectId: string;
}

// Раздел — любая подпапка проекта, поэтому фиксированного списка нет.
// Существование раздела проверяет вызывающий код по discoverProjects.

/** Приводит базовый URL к виду "host/path/" без схемы, www и лишних слешей. */
function normalizeBase(raw: string): string {
 return (raw ?? '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/^www\./, '')
  .replace(/^\/+|\/+$/g, '') + '/';
}

/**
 * Отрезает схему, www, query и fragment, оставляя "host/path".
 * Регистр пути сохраняется — на регистрозависимой ФС он значим.
 */
function normalizeUrl(raw: string): string {
 return (raw ?? '')
  .trim()
  .replace(/^<|>$/g, '')
  .split('#')[0]
  .split('?')[0]
  .replace(/^https?:\/\//i, '')
  .replace(/^www\./i, '');
}

/**
 * Возвращает части ссылки, если URL указывает на документацию
 * одного из базовых адресов. Иначе — null.
 */
export function parseDocsUrl(rawUrl: string, baseUrls: string[]): DocUrlParts | null {
 const url = normalizeUrl(rawUrl);
 if (!url) return null;

 // Хост сравниваем без учета регистра, путь режем из исходной строки.
 const lower = url.toLowerCase();
 const base = baseUrls
  .map(normalizeBase)
  .filter(b => b !== '/')
  .find(b => lower.startsWith(b));

 if (!base) return null;

 const rest = url.slice(base.length).replace(/^\/+|\/+$/g, '');
 if (!rest) return null;

 const segments = rest
  .split('/')
  .filter(Boolean)
  .map(s => s.replace(/\.html?$/, ''));

 // Минимум: проект, раздел и хотя бы одна часть пути к документу.
 if (segments.length < 3) return null;

 // Регистр раздела сохраняем: он совпадает с именем каталога на диске.
 const [projectName, section, ...docSegments] = segments;

 const docPath = docSegments.join('/');
 if (!docPath) return null;

 return {
  projectName,
  section,
  docPath,
  projectId: `${projectName}__${section}`
 };
}

/**
 * Путь к документу относительно текущего файла — для ссылок внутри
 * своего же проекта, где префикс проекта не работает.
 * Разделители всегда POSIX, как того требует RST.
 */
export function buildRelativeDocPath(
 projectRoot: string,
 docPath: string,
 currentFilePath: string
): string {
 const target = path.resolve(projectRoot, ...docPath.split('/'));
 const relative = path.relative(path.dirname(currentFilePath), target);

 return relative.split(path.sep).join('/');
}

/** Оборачивает путь в роль: :doc:`path` */
export function wrapInDocRole(target: string): string {
 return `:doc:\`${target}\``;
}
