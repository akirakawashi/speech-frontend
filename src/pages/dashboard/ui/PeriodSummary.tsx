'use client';

import { kit } from '@/shared/ui/analytics-kit';
import type { DashboardResponse } from '../api/types';
import { summaryText } from '../model/dashboard';
import styles from './PeriodSummary.module.css';

/**
 * Показывает «Итог за период» словами — по всем темам или по выбранной.
 *
 * @param props Свойства компонента.
 * @param props.data Ответ дашборда.
 * @returns Карточка с текстом итога.
 */
export function PeriodSummary({ data }: { data: DashboardResponse }) {
  return (
    <section className={kit.card} aria-label="Итог за период">
      <p className={styles.eyebrow}>Итог за период</p>
      <p className={styles.summary}>{summaryText(data)}</p>
    </section>
  );
}
