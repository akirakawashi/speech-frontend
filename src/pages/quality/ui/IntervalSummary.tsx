'use client';

import { kit } from '@/shared/ui/analytics-kit';
import type { QualitySummaryResponse } from '../api/types';
import { headline } from '../model/headline';
import styles from './IntervalSummary.module.css';

/**
 * Блок макета «Итог по выбранному интервалу»: картина периода одной фразой.
 *
 * Текст собирается из тех же чисел, что на экране (`headline`), а не пишется
 * моделью: итог, расходящийся с графиком над ним, хуже его отсутствия.
 *
 * @param props Свойства компонента.
 * @param props.summary Сводка оценок за период.
 * @param props.who Выбранный сотрудник: итог посчитан по нему.
 * @returns Карточка с заголовком и текстом итога.
 */
export function IntervalSummary({
  summary,
  who,
}: {
  summary: QualitySummaryResponse;
  who?: string;
}) {
  return (
    <section className={styles.summaryCard} aria-label="Итог по выбранному интервалу">
      <h2 className={`${kit.kicker} ${styles.summaryKicker}`}>
        Итог по выбранному интервалу{who ? ` — ${who}` : ''}
      </h2>
      <p className={styles.summaryText}>{headline(summary)}</p>
    </section>
  );
}
