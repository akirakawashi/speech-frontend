'use client';

import { useMemo, useState } from 'react';
import {
  allBranches,
  buildClassifierTree,
  classifierCounts,
  classifierRows,
  expandedUpTo,
  nodeLabel,
} from '@/entities/classifier';
import { formatDate } from '@/shared/lib/format';
import { AsyncTable, adminStyles, Banner, errorText, Pill, Screen } from '@/widgets/admin-shell';
import { useAdminClassifier, useUpdateClassifierNode } from '../api/classifier';
import styles from './TopicsPage.module.css';

/** Раскрыты по умолчанию уровни выше этого: сегмент и продукт видны сразу. */
const OPEN_BELOW_LEVEL = 3;

/**
 * Экран «Темы» — классификатор обращений (SP-310): пять уровней, как у оператора в NCC.
 *
 * Дерево — файл владельца и пути, которые операторы ставят сами (решение S-22).
 * Новый путь из NCC появляется здесь без рук, и администратор решает, оставить
 * его или отключить. Удаления нет: узлом уже могут быть размечены звонки.
 *
 * @returns Счётчики, управление раскрытием и таблица узлов дерева.
 */
export function TopicsPage() {
  const classifier = useAdminClassifier();
  const update = useUpdateClassifierNode();
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  const [onlyNcc, setOnlyNcc] = useState(false);

  const items = classifier.data?.items;
  const roots = useMemo(() => buildClassifierTree(items ?? []), [items]);
  const open = useMemo(() => expanded ?? expandedUpTo(roots, OPEN_BELOW_LEVEL), [expanded, roots]);
  const rows = useMemo(() => classifierRows(roots, open, onlyNcc), [roots, open, onlyNcc]);
  const counts = classifierCounts(items ?? []);

  /**
   * Сворачивает или разворачивает узел дерева.
   *
   * @param id Идентификатор узла.
   */
  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  return (
    <Screen
      title="Темы"
      hint="Классификатор обращений — пять уровней, как у оператора в NCC: файл владельца «Тематики (финал) вариант 2» и пути, которые операторы ставят сами. Новый путь из NCC появляется здесь без рук. Отключённая ветка не предлагается модели; уже размеченные звонки остаются как есть."
    >
      {update.error ? <Banner kind="error">{errorText(update.error)}</Banner> : null}

      <p className={adminStyles.hint}>
        Узлов {counts.total}: из файла {counts.file}, из NCC {counts.ncc}; отключено{' '}
        {counts.inactive}.
      </p>
      <div className={adminStyles.rowActions}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={onlyNcc}
            onChange={(event) => setOnlyNcc(event.target.checked)}
          />
          Только ветки с путями из NCC
        </label>
        <button
          type="button"
          className={adminStyles.ghost}
          disabled={onlyNcc}
          onClick={() => setExpanded(allBranches(roots))}
        >
          Развернуть всё
        </button>
        <button
          type="button"
          className={adminStyles.ghost}
          disabled={onlyNcc}
          onClick={() => setExpanded(new Set())}
        >
          Свернуть всё
        </button>
      </div>

      <AsyncTable
        isLoading={classifier.isLoading}
        error={classifier.error}
        isEmpty={(items ?? []).length === 0}
        emptyText="Классификатор пуст: файл владельца ещё не загружен."
      >
        <table className={adminStyles.table}>
          <thead>
            <tr>
              <th>Узел</th>
              <th className={adminStyles.numeric}>Уровень</th>
              <th>Откуда</th>
              <th className={adminStyles.numeric}>Звонков оператора</th>
              <th>Состояние</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ tree, depth, hasChildren, expanded: isOpen }) => {
              const { node } = tree;
              const label = nodeLabel(node);
              return (
                <tr key={node.id}>
                  <td>
                    <span className={styles.treeCell} style={{ paddingLeft: `${depth * 1.25}rem` }}>
                      {hasChildren ? (
                        <button
                          type="button"
                          className={styles.treeToggle}
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? 'Свернуть' : 'Развернуть'}: ${label}`}
                          disabled={onlyNcc}
                          onClick={() => toggle(node.id)}
                        >
                          {isOpen ? '▾' : '▸'}
                        </button>
                      ) : (
                        <span className={styles.treeLeaf} aria-hidden="true" />
                      )}
                      <span className={node.label ? undefined : styles.emptyLabel}>{label}</span>
                    </span>
                  </td>
                  <td className={adminStyles.numeric}>{node.level}</td>
                  <td>
                    <Pill
                      value={
                        node.source === 'ncc' ? `NCC, с ${formatDate(node.first_seen_at)}` : 'файл'
                      }
                      tone={node.source === 'ncc' ? 'warn' : 'plain'}
                    />
                  </td>
                  <td
                    className={adminStyles.numeric}
                    title="Звонков, которые оператор классифицировал этой веткой"
                  >
                    {tree.branchCalls}
                  </td>
                  <td>
                    <Pill
                      value={node.is_active ? 'включён' : 'отключён'}
                      tone={node.is_active ? 'ok' : 'plain'}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className={adminStyles.ghost}
                      disabled={update.isPending}
                      onClick={() =>
                        update.mutate({ id: node.id, patch: { is_active: !node.is_active } })
                      }
                    >
                      {node.is_active ? 'Отключить' : 'Включить'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AsyncTable>
    </Screen>
  );
}
