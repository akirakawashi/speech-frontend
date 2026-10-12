'use client';

import { periodLabel } from '@/shared/lib/date';
import { percent } from '@/shared/lib/format';
import { kit } from '@/shared/ui/analytics-kit';
import type { DashboardResponse } from '../api/types';
import { count, signedPercent } from '../model/dashboard';
import styles from './Detail.module.css';

/**
 * Показывает детализацию: четыре числа выбранной темы или всех тем.
 *
 * «Изменение» — вторая половина периода к первой; когда сравнивать не с чем, стоит прочерк, а не
 * ноль: ноль значил бы «не изменилось».
 *
 * @param props Свойства компонента.
 * @param props.data Ответ дашборда.
 * @returns Карточка с четырьмя показателями.
 */
export function Detail({ data }: { data: DashboardResponse }) {
  const chosen = data.selection;
  const peak = chosen.peak;
  return (
    <section className={kit.card} aria-label="Детализация">
      <h2 className={kit.cardTitle}>Детализация{chosen.theme ? ` — ${chosen.label}` : ''}</h2>
      <dl className={styles.detail}>
        <div>
          <dt>Обращений за период</dt>
          <dd>{count(chosen.calls)}</dd>
        </div>
        <div>
          <dt>Изменение к 1-й половине</dt>
          <dd>
            {chosen.change === null || chosen.change === undefined
              ? '—'
              : signedPercent(chosen.change)}
          </dd>
        </div>
        <div>
          <dt>Доля негатива</dt>
          <dd>
            {chosen.negative_share === null || chosen.negative_share === undefined
              ? '—'
              : percent(chosen.negative_share)}
          </dd>
        </div>
        <div>
          <dt>Пик за неделю</dt>
          <dd>
            {peak ? count(peak.calls) : '—'}
            {peak ? (
              <span className={styles.detailNote}>
                {periodLabel({ from: peak.start, to: peak.end })}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
    </section>
  );
}
