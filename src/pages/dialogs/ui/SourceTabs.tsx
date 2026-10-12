'use client';

import { type CallSource, SOURCE_LABEL, SOURCES } from '@/entities/call';
import styles from './SourceTabs.module.css';

/** Панель вкладок источника (S-35) и её вкладки — связь для чтения с экрана. */
export const SOURCE_PANEL_ID = 'source-panel';

/**
 * Строит идентификатор вкладки источника.
 *
 * @param source Источник звонков, которому принадлежит вкладка.
 * @returns Значение атрибута `id` вкладки; на него ссылается панель под вкладками.
 */
export function sourceTabId(source: CallSource): string {
  return `source-tab-${source}`;
}

/**
 * Определяет, куда ведёт клавиша с вкладки источника.
 *
 * По образцу вкладок WAI-ARIA: стрелки — к соседней по кругу, Home и End — к
 * крайним. Остальные клавиши не наши: Tab обязан уводить из списка вкладок, а
 * не ходить по нему.
 *
 * @param current Вкладка, на которой стоит фокус.
 * @param key Название нажатой клавиши из события клавиатуры.
 * @returns Источник вкладки, на которую надо перейти, или `null`, если клавиша не управляет вкладками.
 */
function sourceByKey(current: CallSource, key: string): CallSource | null {
  const index = SOURCES.indexOf(current);
  const count = SOURCES.length;
  switch (key) {
    case 'ArrowRight':
      return SOURCES[(index + 1) % count] ?? null;
    case 'ArrowLeft':
      return SOURCES[(index + count - 1) % count] ?? null;
    case 'Home':
      return SOURCES[0];
    case 'End':
      return SOURCES[count - 1] ?? null;
    default:
      return null;
  }
}

/**
 * Показывает вкладки источника звонков (S-35).
 *
 * Вкладки стоят над показателями, а не среди фильтров: от источника зависит всё
 * ниже — счётчики, темы, варианты оператора и очереди, выдача и выгрузка.
 * Фильтр «любой» здесь нарочно не предлагается: смешанный список и был тем, на
 * что жаловался владелец.
 *
 * @param props Свойства компонента.
 * @param props.source Выбранный источник.
 * @param props.onChoose Вызывается с источником вкладки, которую выбрали мышью или клавишей.
 * @returns Список вкладок с бегущим `tabindex`.
 */
export function SourceTabs({
  source,
  onChoose,
}: {
  source: CallSource;
  onChoose: (source: CallSource) => void;
}) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Источник звонков">
      {SOURCES.map((item) => {
        const active = source === item;
        return (
          <button
            type="button"
            role="tab"
            key={item}
            id={sourceTabId(item)}
            aria-selected={active}
            aria-controls={SOURCE_PANEL_ID}
            // Бегущий tabindex: в порядке Tab стоит только выбранная вкладка,
            // между вкладками ходят стрелками.
            tabIndex={active ? 0 : -1}
            className={`${styles.tab} ${active ? styles.tabActive : ''}`}
            onClick={() => onChoose(item)}
            onKeyDown={(event) => {
              const next = sourceByKey(item, event.key);
              if (next === null) return;
              event.preventDefault();
              onChoose(next);
              document.getElementById(sourceTabId(next))?.focus();
            }}
          >
            {SOURCE_LABEL[item]}
          </button>
        );
      })}
    </div>
  );
}
