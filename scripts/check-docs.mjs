// Проверяет докстринги: у каждой функции описано, что она делает, что принимает
// и что возвращает. Правило — в AGENTS.md, раздел «Докстринги».
//
// Функцией считается объявление `function`, стрелочная функция или
// `useCallback`, положенные в переменную, и метод класса. Безымянные
// обработчики — колбэки `map`, обработчики событий в разметке, тела эффектов —
// не считаются: их объясняет функция, внутри которой они стоят.
//
// Запуск: node scripts/check-docs.mjs
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Каталоги и файлы с кодом проекта, от корня. */
const SOURCES = ['app', 'src', 'e2e', 'scripts', 'vitest.setup.ts', 'vitest.config.ts', 'playwright.config.ts', 'next.config.ts'];

/** Сгенерированные файлы: их пишет не человек. */
const GENERATED = new Set(['src/shared/api/schema.d.ts']);

/**
 * Собирает файлы с кодом из каталога со всеми вложенными.
 *
 * @param {string} path Каталог или файл относительно корня проекта.
 * @param {string[]} [found] Накопитель путей; при первом вызове не передаётся.
 * @returns {string[]} Пути файлов `.ts`, `.tsx` и `.mjs` относительно корня проекта.
 */
function collect(path, found = []) {
  const full = join(root, path);
  if (!existsSync(full)) return found;
  if (statSync(full).isDirectory()) {
    for (const name of readdirSync(full)) collect(join(path, name), found);
  } else if (/\.(tsx?|mjs)$/.test(path) && !GENERATED.has(path.replace(/\\/g, '/'))) {
    found.push(path);
  }
  return found;
}

/**
 * Определяет вид разбора по расширению файла.
 *
 * @param {string} path Путь к файлу.
 * @returns {ts.ScriptKind} Вид разбора для компилятора TypeScript.
 */
function kindOf(path) {
  if (path.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (path.endsWith('.mjs')) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/**
 * Достаёт функцию из инициализатора переменной.
 *
 * @param {ts.Expression | undefined} initializer Выражение справа от знака равенства.
 * @returns {ts.ArrowFunction | ts.FunctionExpression | null} Стрелочная функция, функциональное
 *   выражение или первый аргумент `useCallback`; `null`, если в переменной лежит не функция.
 */
function functionIn(initializer) {
  if (!initializer) return null;
  if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) return initializer;
  if (ts.isCallExpression(initializer)) {
    const callee = initializer.expression.getText();
    const first = initializer.arguments[0];
    if (/(^|\.)useCallback$/.test(callee) && first && (ts.isArrowFunction(first) || ts.isFunctionExpression(first))) {
      return first;
    }
  }
  return null;
}

/**
 * Проверяет, возвращает ли функция значение.
 *
 * Решает тип результата, а не вид тела: стрелка `(patch) => setFilters(patch)`
 * записана выражением, но не возвращает ничего. Для файлов без типов — скриптов
 * `.mjs` — остаётся проверка по тексту: есть ли `return` со значением.
 *
 * @param {ts.FunctionLikeDeclaration} fn Функция.
 * @param {ts.TypeChecker | null} checker Проверка типов; `null` — для файла её нет.
 * @returns {boolean} `true`, если функции есть что вернуть.
 */
function returnsValue(fn, checker) {
  if (!fn.body) return false;
  if (checker) {
    const signature = checker.getSignatureFromDeclaration(fn);
    if (signature) return !isVoidLike(checker.getReturnTypeOfSignature(signature), checker);
  }
  if (!ts.isBlock(fn.body)) return true;
  let found = false;
  /**
   * Обходит тело функции, не заходя во вложенные функции.
   *
   * @param {ts.Node} node Узел тела.
   */
  const visit = (node) => {
    if (found || ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node) && node.expression) found = true;
    else ts.forEachChild(node, visit);
  };
  ts.forEachChild(fn.body, visit);
  return found;
}

/**
 * Проверяет, что тип означает «ничего»: `void`, `undefined` или обещание без значения.
 *
 * @param {ts.Type} type Тип результата функции.
 * @param {ts.TypeChecker} checker Проверка типов.
 * @returns {boolean} `true`, если описывать результат незачем.
 */
function isVoidLike(type, checker) {
  const empty = ts.TypeFlags.Void | ts.TypeFlags.Undefined | ts.TypeFlags.Never;
  if (type.flags & empty) return true;
  if (type.isUnion()) return type.types.every((part) => isVoidLike(part, checker));
  if (type.symbol?.name === 'Promise') {
    const [inner] = checker.getTypeArguments(type);
    return inner ? isVoidLike(inner, checker) : false;
  }
  return false;
}

/**
 * Перечисляет имена, под которыми должны быть описаны параметры функции.
 *
 * Обычный параметр описывается своим именем. Разобранный на свойства —
 * общим именем (`props`) и каждым свойством через точку: `props.callId`.
 *
 * @param {ts.FunctionLikeDeclaration} fn Функция.
 * @returns {{ plain: string[], destructured: string[][] }} Имена обычных параметров и, для каждого
 *   разобранного параметра, имена его свойств.
 */
function expectedParams(fn) {
  const plain = [];
  const destructured = [];
  for (const param of fn.parameters) {
    if (ts.isIdentifier(param.name)) {
      if (param.name.text !== 'this') plain.push(param.name.text);
    } else if (ts.isObjectBindingPattern(param.name)) {
      destructured.push(
        param.name.elements.map((element) => (element.propertyName ?? element.name).getText()),
      );
    } else {
      destructured.push([]);
    }
  }
  return { plain, destructured };
}

/**
 * Сверяет докстринг функции с её подписью.
 *
 * @param {ts.Node} owner Узел, к которому привязан докстринг: объявление функции, переменная или метод.
 * @param {ts.FunctionLikeDeclaration} fn Сама функция.
 * @param {ts.TypeChecker | null} checker Проверка типов; `null` — для файла её нет.
 * @returns {string[]} Чего не хватает докстрингу; пустой список — докстринг полон.
 */
function gaps(owner, fn, checker) {
  const docs = ts.getJSDocCommentsAndTags(owner).filter(ts.isJSDoc);
  if (docs.length === 0) return ['нет докстринга'];
  const missing = [];
  const described = docs.some((doc) => ts.getTextOfJSDocComment(doc.comment)?.trim());
  if (!described) missing.push('не сказано, что делает');

  const tags = docs.flatMap((doc) => doc.tags ?? []);
  const params = new Map();
  for (const tag of tags) {
    if (ts.isJSDocParameterTag(tag)) params.set(tag.name.getText(), ts.getTextOfJSDocComment(tag.comment)?.trim() ?? '');
  }
  const expected = expectedParams(fn);
  for (const name of expected.plain) {
    if (!params.get(name)) missing.push(`@param ${name}`);
  }
  for (const properties of expected.destructured) {
    const roots = [...params.keys()].filter((name) => !name.includes('.'));
    const rootName = roots.find((name) => !expected.plain.includes(name));
    if (!rootName) {
      missing.push('@param props');
      continue;
    }
    for (const property of properties) {
      if (!params.get(`${rootName}.${property}`)) missing.push(`@param ${rootName}.${property}`);
    }
  }

  const returns = tags.find((tag) => ts.isJSDocReturnTag(tag));
  const isConstructor = ts.isConstructorDeclaration(fn);
  if (!isConstructor && returnsValue(fn, checker) && !ts.getTextOfJSDocComment(returns?.comment)?.trim()) {
    missing.push('@returns');
  }
  return missing;
}

const problems = [];
let total = 0;

const paths = SOURCES.flatMap((source) => collect(source));
const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const typed = paths.filter((path) => !path.endsWith('.mjs')).map((path) => join(root, path));
const program = ts.createProgram([...typed, join(root, 'next-env.d.ts')].filter(existsSync), {
  ...options,
  noEmit: true,
  incremental: false,
});
const typeChecker = program.getTypeChecker();

for (const path of paths) {
  const text = readFileSync(join(root, path), 'utf8');
  const typedFile = program.getSourceFile(join(root, path));
  const file = typedFile ?? ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kindOf(path));
  const checker = typedFile ? typeChecker : null;
  /**
   * Обходит дерево файла и сверяет докстринг каждой функции.
   *
   * @param {ts.Node} node Узел дерева.
   */
  const visit = (node) => {
    let owner = null;
    let fn = null;
    let name = '';
    if (ts.isFunctionDeclaration(node) && node.body) {
      owner = node;
      fn = node;
      name = node.name?.text ?? 'default';
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      fn = functionIn(node.initializer);
      owner = node;
      name = node.name.text;
    } else if (
      (ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isAccessor(node)) &&
      ts.isClassLike(node.parent)
    ) {
      owner = node;
      fn = node;
      name = ts.isConstructorDeclaration(node) ? 'constructor' : node.name.getText();
    }
    if (owner && fn) {
      total += 1;
      const missing = gaps(owner, fn, checker);
      if (missing.length > 0) {
        const { line } = file.getLineAndCharacterOfPosition(owner.getStart(file));
        problems.push(`${relative(root, join(root, path))}:${line + 1} ${name}: ${missing.join(', ')}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
}

for (const line of problems) console.error(line);
if (problems.length > 0) {
  console.error(`\nФункций без полного докстринга: ${problems.length} из ${total}`);
  process.exit(1);
}
console.log(`Докстринги сверены: функций ${total}, замечаний нет.`);
