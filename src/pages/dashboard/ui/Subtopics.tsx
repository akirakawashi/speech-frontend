'use client';

import { percent } from '@/shared/lib/format';
import { kit } from '@/shared/ui/analytics-kit';
import type { DashboardResponse } from '../api/types';
import { count } from '../model/dashboard';
import styles from './Subtopics.module.css';

/**
 * Показывает подтемы выбранной темы.
 *
 * У «Прочего» — темы, которые в него сложены.
 *
 * @param props Свойства компонента.
 * @param props.data Ответ дашборда.
 * @returns Карточка со списком подтем или `null`, если тема не выбрана или подтем нет.
 */
export function Subtopics({ data }: { data: DashboardResponse }) {
  const subtopics = data.selection.subtopics ?? [];
  if (!data.selection.theme || subtopics.length === 0) return null;
  return (
    <section className={kit.card} aria-label="Внутренние темы">
      <div className={kit.cardHead}>
        <h2 className={kit.cardTitle}>Внутренние темы — {data.selection.label}</h2>
        <span className={kit.hint}>доля обращений темы</span>
      </div>
      <ul className={styles.subtopics}>
        {subtopics.map((subtopic) => (
          <li key={subtopic.key} className={styles.subtopic}>
            <span>{subtopic.label}</span>
            <span className={styles.subtopicBar} aria-hidden="true">
              <span className={styles.subtopicFill} style={{ width: `${subtopic.share * 100}%` }} />
            </span>
            <b>{percent(subtopic.share)}</b>
            <span className={styles.subtopicCalls}>{count(subtopic.calls)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
