'use client';

import { percent } from '@/shared/lib/format';
import { kit } from '@/shared/ui/analytics-kit';
import type { DashboardResponse } from '../api/types';
import common from './common.module.css';
import styles from './NegativeMeter.module.css';

/**
 * Показывает долю негатива за период одним числом: не график, а показатель с кольцом-шкалой.
 *
 * Считается среди звонков с тональностью: неразобранные в знаменатель не идут.
 *
 * @param props Свойства компонента.
 * @param props.data Ответ дашборда.
 * @returns Карточка с кольцом-шкалой и подписью.
 */
export function NegativeMeter({ data }: { data: DashboardResponse }) {
  const share = data.selection.negative_share;
  const known = share !== null && share !== undefined;
  const scope = data.selection.theme
    ? `по теме «${data.selection.label}» за весь выбранный период`
    : 'по всем темам за весь выбранный период';
  return (
    <section className={`${kit.card} ${styles.meterCard}`} aria-label="Доля негатива">
      <div
        className={styles.meter}
        style={{
          background: `conic-gradient(var(--negative) ${(known ? share : 0) * 360}deg, var(--negative-track) 0)`,
        }}
        aria-hidden="true"
      >
        <span className={styles.meterCenter}>{known ? percent(share) : '—'}</span>
      </div>
      <div className={styles.meterText}>
        <span className={styles.meterTitle}>
          Доля негатива{known ? ` — ${percent(share)}` : ''}
        </span>
        <span className={common.caption}>
          {known ? scope : 'у звонков периода ещё нет тональности'}
        </span>
      </div>
    </section>
  );
}
