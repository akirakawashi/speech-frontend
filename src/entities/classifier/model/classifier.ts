/**
 * Классификатор обращений (SP-310) — дерево из плоского списка узлов.
 *
 * Сервер отдаёт узлы плоско, со ссылкой на родителя: дерево, счёт по ветке и
 * отбор собираются здесь, одной функцией на всё. Экран и тесты видят одно и то
 * же дерево, а не каждый своё.
 */

export type ClassifierNode = {
  id: string;
  parent_id?: string | null;
  level: number;
  label: string;
  source: 'file' | 'ncc';
  sort_order: number;
  is_active: boolean;
  first_seen_at: string;
  operator_calls?: number;
};

export type ClassifierTree = {
  node: ClassifierNode;
  children: ClassifierTree[];
  /** Звонков, классифицированных оператором узлом этой ветки, включая сам узел. */
  branchCalls: number;
  /** Узлов из NCC в ветке, включая сам узел. */
  branchNcc: number;
};

export type ClassifierRow = {
  tree: ClassifierTree;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
};

/** Как показывается пустой уровень в середине пути: «Кошелёк» без уровня 1. */
export const EMPTY_LEVEL_LABEL = '(пусто)';

/** Уровней в классификации оператора и ИИ: `uroven_1…5`. */
export const CLASSIFIER_DEPTH = 5;

/** Разделитель уровней в подписи пути — тот же, что в отчёте и выгрузке. */
export const PATH_SEPARATOR = ' › ';

/**
 * Называет узел классификатора.
 *
 * @param node Узел с подписью.
 * @returns Подпись узла или «(пусто)», если подписи нет.
 */
export function nodeLabel(node: Pick<ClassifierNode, 'label'>): string {
  return node.label || EMPTY_LEVEL_LABEL;
}

/**
 * Склеивает путь по классификатору в одну строку (SP-310).
 *
 * Пустой уровень в середине — «(пусто)»: без подписи «Кошелёк» без уровня 1 читался бы путём,
 * начатым с «Кошелька».
 *
 * @param labels Подписи уровней от первого; `null` или `undefined` — пути нет.
 * @returns Уровни через разделитель; пустой уровень заменён на «(пусто)».
 */
export function pathCaption(labels: readonly string[] | null | undefined): string {
  return (labels ?? []).map((label) => label || EMPTY_LEVEL_LABEL).join(PATH_SEPARATOR);
}

/** Узел для выбора по уровням: плоско, со ссылкой на родителя. */
export type PickerNode = {
  id: string;
  parent_id?: string | null;
  level: number;
  label: string;
  sort_order: number;
  is_active?: boolean;
};

export type PickerLevel<T extends PickerNode> = {
  level: number;
  options: T[];
  /** Выбранный на этом уровне узел; пусто — «любой». */
  selected: string;
};

/**
 * Раскладывает выбор узла на уровни для выпадающих списков (SP-310): уровень 1, под выбранным узлом
 * — его уточнения, и так до узла без уточнений.
 *
 * Значение — один узел, цепочка над ним восстанавливается по дереву: ссылка с
 * `node_id` открывает выбор на своём месте. Выключенный узел для нового выбора
 * не предлагается, но в цепочке остаётся — ссылка на него должна показать, чем
 * отфильтрована выдача.
 *
 * @param nodes Узлы классификатора плоским списком.
 * @param value Идентификатор выбранного узла; пустая строка — ничего не выбрано.
 * @returns Уровни сверху вниз: варианты каждого и выбранный на нём узел.
 */
export function pickerLevels<T extends PickerNode>(
  nodes: readonly T[],
  value: string,
): PickerLevel<T>[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const chain: T[] = [];
  let current = byId.get(value);
  while (current && chain.length < CLASSIFIER_DEPTH) {
    chain.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  const onChain = new Set(chain.map((node) => node.id));
  /**
   * Отбирает уточнения узла, которые можно предложить для выбора.
   *
   * @param parent Идентификатор узла; `null` — узлы первого уровня.
   * @returns Включённые дочерние узлы и узлы выбранной цепочки, по местам.
   */
  const childrenOf = (parent: string | null) =>
    nodes
      .filter(
        (node) =>
          (node.parent_id ?? null) === parent && (node.is_active !== false || onChain.has(node.id)),
      )
      .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, 'ru'));

  const levels: PickerLevel<T>[] = [];
  let parent: string | null = null;
  for (let index = 0; index <= chain.length; index += 1) {
    const options = childrenOf(parent);
    if (options.length === 0) break;
    const selected = chain[index]?.id ?? '';
    levels.push({ level: index + 1, options, selected });
    if (!selected) break;
    parent = selected;
  }
  return levels;
}

/**
 * Сравнивает узлы по месту в дереве: порядок файла, затем название.
 *
 * @param a Первый узел.
 * @param b Второй узел.
 * @returns Отрицательное число, если первый узел стоит раньше; положительное — если позже.
 */
function byPlace(a: ClassifierNode, b: ClassifierNode): number {
  return a.sort_order - b.sort_order || a.label.localeCompare(b.label, 'ru');
}

/**
 * Собирает дерево классификатора из плоского списка узлов: порядок файла, узлы из NCC — после.
 *
 * Узел, чей родитель в список не попал, встаёт в корень, а не пропадает:
 * расхождение дерева надо увидеть, а не спрятать.
 *
 * @param items Узлы плоским списком со ссылкой на родителя.
 * @returns Корни дерева по местам; у каждого узла посчитаны звонки и узлы NCC по ветке.
 */
export function buildClassifierTree(items: readonly ClassifierNode[]): ClassifierTree[] {
  const ids = new Set(items.map((item) => item.id));
  const children = new Map<string, ClassifierNode[]>();
  for (const item of items) {
    if (!item.parent_id || !ids.has(item.parent_id)) continue;
    const bucket = children.get(item.parent_id) ?? [];
    bucket.push(item);
    children.set(item.parent_id, bucket);
  }

  /**
   * Собирает ветку под узлом и считает по ней звонки и узлы из NCC.
   *
   * @param node Узел, с которого начинается ветка.
   * @returns Узел дерева со своими потомками.
   */
  const build = (node: ClassifierNode): ClassifierTree => {
    const kids = [...(children.get(node.id) ?? [])].sort(byPlace).map(build);
    return {
      node,
      children: kids,
      branchCalls: (node.operator_calls ?? 0) + kids.reduce((sum, kid) => sum + kid.branchCalls, 0),
      branchNcc:
        (node.source === 'ncc' ? 1 : 0) + kids.reduce((sum, kid) => sum + kid.branchNcc, 0),
    };
  };

  return items
    .filter((item) => !item.parent_id || !ids.has(item.parent_id))
    .sort(byPlace)
    .map(build);
}

/**
 * Определяет, какие узлы раскрыты по умолчанию: уровни выше `level` — сегмент и продукт видны
 * сразу.
 *
 * @param roots Корни дерева.
 * @param level Уровень, начиная с которого узлы свёрнуты.
 * @returns Идентификаторы узлов выше этого уровня.
 */
export function expandedUpTo(roots: readonly ClassifierTree[], level: number): Set<string> {
  const open = new Set<string>();
  /**
   * Отмечает узел раскрытым и спускается к потомкам, пока не дойдёт до уровня.
   *
   * @param tree Узел дерева.
   */
  const walk = (tree: ClassifierTree) => {
    if (tree.node.level >= level) return;
    open.add(tree.node.id);
    for (const kid of tree.children) walk(kid);
  };
  for (const root of roots) walk(root);
  return open;
}

/**
 * Собирает узлы, у которых есть дети, — для «развернуть всё».
 *
 * @param roots Корни дерева.
 * @returns Идентификаторы всех узлов, у которых есть потомки.
 */
export function allBranches(roots: readonly ClassifierTree[]): Set<string> {
  const open = new Set<string>();
  /**
   * Отмечает узел с потомками и спускается к ним.
   *
   * @param tree Узел дерева.
   */
  const walk = (tree: ClassifierTree) => {
    if (tree.children.length === 0) return;
    open.add(tree.node.id);
    for (const kid of tree.children) walk(kid);
  };
  for (const root of roots) walk(root);
  return open;
}

/**
 * Раскладывает дерево в строки таблицы в порядке дерева.
 *
 * С отбором «только из NCC» показываются ветки, в которых есть узлы из NCC, —
 * и сразу раскрытыми: новый путь надо увидеть целиком, с родителями, иначе
 * «Подключение» без «Заявки» над ним ничего не говорит.
 *
 * @param roots Корни дерева.
 * @param expanded Идентификаторы раскрытых узлов.
 * @param onlyNcc Показывать только ветки, в которых есть узлы из NCC.
 * @returns Строки сверху вниз: узел, глубина вложенности, есть ли потомки и раскрыт ли.
 */
export function classifierRows(
  roots: readonly ClassifierTree[],
  expanded: ReadonlySet<string>,
  onlyNcc: boolean,
): ClassifierRow[] {
  const rows: ClassifierRow[] = [];
  /**
   * Добавляет строку узла и, если он раскрыт, строки его потомков.
   *
   * @param tree Узел дерева.
   * @param depth Глубина вложенности узла.
   */
  const walk = (tree: ClassifierTree, depth: number) => {
    if (onlyNcc && tree.branchNcc === 0) return;
    const hasChildren = tree.children.length > 0;
    const open = hasChildren && (onlyNcc || expanded.has(tree.node.id));
    rows.push({ tree, depth, hasChildren, expanded: open });
    if (open) for (const kid of tree.children) walk(kid, depth + 1);
  };
  for (const root of roots) walk(root, 0);
  return rows;
}

export type ClassifierCounts = { total: number; file: number; ncc: number; inactive: number };

/**
 * Считает узлы классификатора по происхождению и состоянию.
 *
 * @param items Узлы плоским списком.
 * @returns Сколько узлов всего, из файла владельца, из NCC и сколько отключено.
 */
export function classifierCounts(items: readonly ClassifierNode[]): ClassifierCounts {
  return {
    total: items.length,
    file: items.filter((item) => item.source === 'file').length,
    ncc: items.filter((item) => item.source === 'ncc').length,
    inactive: items.filter((item) => !item.is_active).length,
  };
}
