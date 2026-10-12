'use client';

import type { QualitySummaryResponse } from '@/api/client';
import styles from '@/app/quality/quality.module.css';
import { headline } from '@/lib/quality';

/**
 * Итог по выбранному интервалу — блок макета заказчика: картина периода одной
 * фразой.
 *
 * Текст собирается из тех же чисел, что на экране (`headline`), а не пишется
 * моделью: итог, расходящийся с графиком над ним, хуже его отсутствия.
 */
export function IntervalSummary({
  summary,
  who,
}: {
  summary: QualitySummaryResponse;
  /** Выбранный сотрудник: итог посчитан по нему. */
  who?: string;
}) {
  return (
    <section className={styles.summaryCard} aria-label="Итог по выбранному интервалу">
      <h2 className={styles.kicker}>Итог по выбранному интервалу{who ? ` — ${who}` : ''}</h2>
      <p className={styles.summaryText}>{headline(summary)}</p>
    </section>
  );
}
