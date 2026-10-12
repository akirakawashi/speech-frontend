// Сверяет компоненты с их CSS-модулями.
//
// TypeScript не знает, какие классы есть в модуле: опечатка в `styles.titel`
// даёт `undefined` вместо класса, и элемент молча теряет оформление. Проверка
// находит обращения к несуществующим классам и классы, на которые никто не
// ссылается.
//
// Запуск: node scripts/check-styles.mjs
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');

/**
 * Собирает файлы каталога со всеми вложенными.
 *
 * @param {string} dir Каталог, с которого начинается обход.
 * @param {string[]} [found] Накопитель путей; при первом вызове не передаётся.
 * @returns {string[]} Абсолютные пути всех файлов внутри каталога.
 */
function walk(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, found);
    else found.push(path);
  }
  return found;
}

/**
 * Читает имена классов, объявленных в CSS-модуле.
 *
 * @param {string} path Абсолютный путь к файлу стилей.
 * @returns {Set<string>} Имена классов без точки.
 */
function classesOf(path) {
  const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set([...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((match) => match[1]));
}

/**
 * Находит CSS-модуль, который срез отдаёт наружу под именем.
 *
 * Таблица стилей другого среза берётся через его публичный API:
 * `export { default as kit } from './kit.module.css'`.
 *
 * @param {string} specifier Путь импорта вида `@/shared/ui/analytics-kit`.
 * @param {string} name Имя, под которым импортирована таблица стилей.
 * @returns {string | null} Абсолютный путь к модулю или `null`, если срез такого имени не отдаёт.
 */
function exportedModule(specifier, name) {
  if (!specifier.startsWith('@/')) return null;
  const index = join(src, specifier.slice(2), 'index.ts');
  if (!existsSync(index)) return null;
  const pattern = new RegExp(`export \\{ default as ${name} \\} from '([^']+\\.module\\.css)'`);
  const found = pattern.exec(readFileSync(index, 'utf8'));
  return found ? resolve(dirname(index), found[1]) : null;
}

const problems = [];
const referenced = new Map();
const files = walk(src);

for (const file of files.filter((path) => /\.tsx?$/.test(path))) {
  const text = readFileSync(file, 'utf8');
  const modules = new Map();
  for (const match of text.matchAll(/import\s+(\w+)\s+from\s+'([^']+\.module\.css)'/g)) {
    const target = match[2].startsWith('@/') ? join(src, match[2].slice(2)) : resolve(dirname(file), match[2]);
    modules.set(match[1], target);
  }
  for (const match of text.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+'(@\/[^']+)'/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop();
      const target = name ? exportedModule(match[2], name) : null;
      if (name && target) modules.set(name, target);
    }
  }
  // Обращения ищутся в коде без импортов: в пути `./common.module.css` имя
  // `common` тоже стоит перед точкой, и это не обращение к классу.
  const code = text.replace(/import\s[^;]*?from\s+'[^']+';?/g, '');
  for (const [alias, target] of modules) {
    if (!existsSync(target)) {
      problems.push(`${relative(root, file)}: модуля стилей нет — ${relative(root, target)}`);
      continue;
    }
    const known = classesOf(target);
    if (!referenced.has(target)) referenced.set(target, new Set());
    if (new RegExp(`\\b${alias}\\[`).test(code)) {
      // Имя класса вычисляется: проверить его нельзя, считать лишним — тоже.
      for (const name of known) referenced.get(target).add(name);
    }
    for (const match of code.matchAll(new RegExp(`\\b${alias}\\.([A-Za-z_]\\w*)`, 'g'))) {
      referenced.get(target).add(match[1]);
      if (!known.has(match[1])) {
        problems.push(`${relative(root, file)}: класса «${match[1]}» нет в ${relative(root, target)}`);
      }
    }
  }
}

for (const file of files.filter((path) => path.endsWith('.module.css'))) {
  const used = referenced.get(file) ?? new Set();
  const unused = [...classesOf(file)].filter((name) => !used.has(name));
  if (unused.length > 0) {
    problems.push(`${relative(root, file)}: на классы никто не ссылается — ${unused.join(', ')}`);
  }
}

for (const line of problems) console.error(line);
if (problems.length > 0) {
  console.error(`\nРасхождений между компонентами и стилями: ${problems.length}`);
  process.exit(1);
}
console.log(`Стили сверены: модулей ${referenced.size}, расхождений нет.`);
