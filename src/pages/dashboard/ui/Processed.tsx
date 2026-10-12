'use client';

import type { StatsResponse } from '@/features/call-search';
import { percent } from '@/shared/lib/format';
import { count } from '../model/dashboard';
import common from './common.module.css';
import styles from './Processed.module.css';

/**
 * Показывает блок «Обработано звонков»: сколько звонков периода заведено, сколько из них уже
 * расшифровано и сколько ещё в обработке.
 *
 * Числа — те же, что над списком «Диалогов» (`/api/v1/stats`): счёт сбора, а не тем.
 *
 * @param props Свойства компонента.
 * @param props.stats Счёты периода; `undefined` — ещё не загружены.
 * @returns Блок с числом звонков и полосой готовности.
 */
export function Processed({ stats }: { stats: StatsResponse | undefined }) {
  const processed = stats?.processed ?? 0;
  const transcribed = stats?.transcribed ?? 0;
  const share = processed > 0 ? transcribed / processed : 0;
  return (
    <section className={styles.processed} aria-label="Обработано звонков">
      <div className={styles.processedLead}>
        <p className={common.caption}>Обработано звонков за период</p>
        <span className={styles.figure}>{stats ? count(processed) : '—'}</span>
      </div>
      <span className={styles.rule} aria-hidden="true" />
      <div className={styles.readiness}>
        <div className={styles.readinessHead}>
          <span>
            <span className={`${styles.dot} ${styles.dotDone}`} aria-hidden="true" />
            Расшифровано <b>{stats ? count(transcribed) : '—'}</b>
          </span>
          <span>
            <span className={`${styles.dot} ${styles.dotQueued}`} aria-hidden="true" />В очереди{' '}
            <b>{stats ? count(stats.queued) : '—'}</b>
          </span>
          {processed > 0 ? (
            <span className={styles.readinessShare}>{percent(share)} готово</span>
          ) : null}
        </div>
        <div className={styles.progress} aria-hidden="true">
          <span className={styles.progressFill} style={{ width: `${share * 100}%` }} />
        </div>
      </div>
    </section>
  );
}
