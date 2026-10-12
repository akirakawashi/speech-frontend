import { describe, expect, it } from 'vitest';
import {
  allBranches,
  buildClassifierTree,
  type ClassifierNode,
  classifierCounts,
  classifierRows,
  EMPTY_LEVEL_LABEL,
  expandedUpTo,
  nodeLabel,
  pathCaption,
  pickerLevels,
} from '@/lib/classifier';

function node(
  id: string,
  parent: string | null,
  level: number,
  label: string,
  extra: Partial<ClassifierNode> = {},
): ClassifierNode {
  return {
    id,
    parent_id: parent,
    level,
    label,
    source: 'file',
    sort_order: 0,
    is_active: true,
    first_seen_at: '2026-09-15T10:00:00Z',
    operator_calls: 0,
    ...extra,
  };
}

/** Физ.лицо › ШПД › Консультация › Не работает › Wi-Fi и новая «Заявка» из NCC. */
const ITEMS: ClassifierNode[] = [
  node('b2b', null, 1, 'В2В', { sort_order: 1 }),
  node('fiz', null, 1, 'Физ.лицо', { sort_order: 0 }),
  node('shpd', 'fiz', 2, 'ШПД', { sort_order: 2 }),
  node('cons', 'shpd', 3, 'Консультация', { sort_order: 3 }),
  node('broken', 'cons', 4, 'Не работает', { sort_order: 4, operator_calls: 1 }),
  node('wifi', 'broken', 5, 'Wi-Fi', { sort_order: 5, operator_calls: 38 }),
  node('request', 'cons', 4, 'Заявка', { source: 'ncc', sort_order: 100_000 }),
  node('connect', 'request', 5, 'Подключение', {
    source: 'ncc',
    sort_order: 100_000,
    operator_calls: 2,
    is_active: false,
  }),
  node('empty', null, 1, '', { source: 'ncc', sort_order: 100_000 }),
];

describe('дерево классификатора', () => {
  it('строится по местам: порядок файла, узлы из NCC после', () => {
    const roots = buildClassifierTree(ITEMS);

    expect(roots.map((root) => root.node.id)).toEqual(['fiz', 'b2b', 'empty']);
    const consultation = roots[0]?.children[0]?.children[0];
    expect(consultation?.children.map((kid) => kid.node.label)).toEqual(['Не работает', 'Заявка']);
  });

  it('считает звонки оператора и узлы из NCC по всей ветке', () => {
    const [fiz] = buildClassifierTree(ITEMS);

    expect(fiz?.branchCalls).toBe(41);
    expect(fiz?.branchNcc).toBe(2);
  });

  it('узел без родителя в списке встаёт в корень, а не пропадает', () => {
    const roots = buildClassifierTree([node('orphan', 'gone', 3, 'Консультация')]);

    expect(roots.map((root) => root.node.id)).toEqual(['orphan']);
  });

  it('пустой уровень показывается словами', () => {
    expect(nodeLabel({ label: '' })).toBe(EMPTY_LEVEL_LABEL);
    expect(nodeLabel({ label: 'ШПД' })).toBe('ШПД');
  });
});

describe('строки таблицы', () => {
  it('по умолчанию раскрыты сегмент и продукт', () => {
    const roots = buildClassifierTree(ITEMS);

    const rows = classifierRows(roots, expandedUpTo(roots, 3), false);

    expect(rows.map((row) => row.tree.node.id)).toEqual(['fiz', 'shpd', 'cons', 'b2b', 'empty']);
    expect(rows.find((row) => row.tree.node.id === 'cons')).toMatchObject({
      depth: 2,
      hasChildren: true,
      expanded: false,
    });
  });

  it('«развернуть всё» показывает каждый узел', () => {
    const roots = buildClassifierTree(ITEMS);

    expect(classifierRows(roots, allBranches(roots), false)).toHaveLength(ITEMS.length);
  });

  it('с отбором «из NCC» — только ветки с новыми узлами, раскрытые целиком', () => {
    const roots = buildClassifierTree(ITEMS);

    const rows = classifierRows(roots, new Set(), true);

    expect(rows.map((row) => row.tree.node.id)).toEqual([
      'fiz',
      'shpd',
      'cons',
      'request',
      'connect',
      'empty',
    ]);
  });
});

describe('счёт узлов', () => {
  it('по происхождению и отключённые', () => {
    expect(classifierCounts(ITEMS)).toEqual({ total: 9, file: 6, ncc: 3, inactive: 1 });
  });
});

describe('путь одной строкой', () => {
  it('пустой уровень подписан словами, пустой путь — пустая строка', () => {
    expect(pathCaption(['', 'Кошелек', 'Консультация'])).toBe(
      `${EMPTY_LEVEL_LABEL} › Кошелек › Консультация`,
    );
    expect(pathCaption([])).toBe('');
    expect(pathCaption(undefined)).toBe('');
  });
});

describe('выбор по уровням', () => {
  it('без значения — только уровень 1 в порядке файла', () => {
    const levels = pickerLevels(ITEMS, '');

    expect(levels).toHaveLength(1);
    expect(levels[0]?.options.map((option) => option.id)).toEqual(['fiz', 'b2b', 'empty']);
    expect(levels[0]?.selected).toBe('');
  });

  it('узел из адреса раскрывает цепочку и предлагает уточнения под собой', () => {
    const levels = pickerLevels(ITEMS, 'cons');

    expect(levels.map((level) => level.selected)).toEqual(['fiz', 'shpd', 'cons', '']);
    expect(levels[3]?.options.map((option) => option.id)).toEqual(['broken', 'request']);
  });

  it('у узла без уточнений следующего уровня нет', () => {
    expect(pickerLevels(ITEMS, 'wifi').map((level) => level.selected)).toEqual([
      'fiz',
      'shpd',
      'cons',
      'broken',
      'wifi',
    ]);
  });

  it('выключенный узел не предлагается, но выбранный — виден', () => {
    expect(pickerLevels(ITEMS, 'request')).toHaveLength(4);
    expect(pickerLevels(ITEMS, 'connect').map((level) => level.selected)).toEqual([
      'fiz',
      'shpd',
      'cons',
      'request',
      'connect',
    ]);
  });

  it('незнакомый узел — как пустой выбор', () => {
    expect(pickerLevels(ITEMS, 'gone').map((level) => level.selected)).toEqual(['']);
  });
});
