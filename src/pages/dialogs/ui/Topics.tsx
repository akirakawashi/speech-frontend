'use client';

import { PATH_SEPARATOR, pathCaption } from '@/entities/classifier';
import { type SearchState, type StatsResponse, toggleNode } from '@/features/call-search';
import common from './common.module.css';
import styles from './Topics.module.css';

/** Сколько тем показывает блок: самые частые за период. */
const VISIBLE_TOPICS = 10;

/**
 * Показывает основные темы периода — ветки классификатора по классификации ИИ
 * (SRC-07).
 *
 * Тема — фильтр по ветке, а не поиск её названия (SP-507): поиск слова
 * «Роуминг» находил одноимённые темы других веток и все упоминания. Путь над
 * темой приглушён: «Не работает» в ШПД и в мобильной связи — разные темы, но
 * читается тема.
 *
 * @param props Свойства компонента.
 * @param props.topics Темы периода с числом звонков, от частой к редкой.
 * @param props.state Состояние поиска: по нему отмечена выбранная тема.
 * @param props.onChange Вызывается с новым состоянием поиска при выборе или снятии темы.
 * @returns Ряд кнопок-тем или `null`, если тем за период нет.
 */
export function Topics({
  topics,
  state,
  onChange,
}: {
  topics: NonNullable<StatsResponse['topics']>;
  state: SearchState;
  onChange: (next: SearchState) => void;
}) {
  if (topics.length === 0) return null;
  return (
    <section className={styles.topics} aria-label="Основные темы за период">
      {topics.slice(0, VISIBLE_TOPICS).map((topic) => {
        const path = topic.path ?? [];
        const active = state.nodeId === topic.node_id;
        return (
          <button
            type="button"
            key={topic.node_id}
            className={`${styles.topicChip} ${active ? styles.topicChipActive : ''}`}
            aria-pressed={active}
            title={pathCaption(path)}
            onClick={() => onChange(toggleNode(state, topic.node_id))}
          >
            {path.length > 1 ? (
              <span className={styles.topicTrail}>
                {pathCaption(path.slice(0, -1))}
                {PATH_SEPARATOR}
              </span>
            ) : null}
            {pathCaption(path.slice(-1))}
            <span className={styles.topicCount}>{topic.calls}</span>
          </button>
        );
      })}
      {state.nodeId ? (
        <button
          type="button"
          className={common.ghost}
          onClick={() => onChange({ ...state, nodeId: '', page: 1 })}
        >
          Снять фильтр по классификации
        </button>
      ) : null}
    </section>
  );
}
