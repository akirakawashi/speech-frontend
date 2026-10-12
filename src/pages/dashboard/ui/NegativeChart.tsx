'use client';

import { percent } from '@/shared/lib/format';
import { kit } from '@/shared/ui/analytics-kit';
import type { DashboardResponse } from '../api/types';
import { GRAIN_WORD, spansYears } from '../model/chart';
import { axisTicks, bucketLabel, bucketSpan } from '../model/dashboard';
import { type Column, Columns } from './Columns';

const NEGATIVE_HEIGHT = 96;

/**
 * Рисует долю негатива по тем же корзинам — строго под графиком тем: столбец под столбцом.
 *
 * Отдельный график, а не вторая шкала на первом: у числа обращений и у доли нет общей оси, и
 * совмещённые они показывали бы связь, которой нет.
 *
 * Ряд один, поэтому легенды нет — что на графике, говорит заголовок. Корзина
 * без звонков с тональностью стоит пустой: ноль значил бы «негатива нет».
 *
 * @param props Свойства компонента.
 * @param props.data Ответ дашборда.
 * @returns Карточка с графиком или `null`, если тональности нет ни в одной корзине.
 */
export function NegativeChart({ data }: { data: DashboardResponse }) {
  const buckets = data.buckets ?? [];
  const withYear = spansYears(data);
  const shares = buckets.map((bucket) => bucket.negative_share ?? null);
  if (shares.every((share) => share === null)) return null;

  const top = Math.max(0.05, ...shares.map((share) => share ?? 0));
  const ticks = axisTicks(Math.ceil(top * 100), 2).map((tick) => tick / 100);
  const columns: Column[] = buckets.map((bucket, index) => {
    const span = { from: bucket.start, to: bucket.end };
    const share = shares[index] ?? null;
    return {
      key: bucket.start,
      label: bucketLabel(span, data.grain, withYear),
      title: bucketSpan(span),
      total: share,
      caption: share === null ? 'нет оценённых звонков' : percent(share),
      segments:
        share === null
          ? []
          : [
              {
                key: 'negative',
                label: 'Доля негатива',
                color: 'var(--negative)',
                value: share,
                text: percent(share),
              },
            ],
    };
  });

  return (
    <section className={kit.card} aria-label="Доля негатива по корзинам периода">
      <div className={kit.cardHead}>
        <h2 className={kit.cardTitle}>Доля негатива — по {GRAIN_WORD[data.grain]}</h2>
        <span className={kit.hint}>по всем темам</span>
      </div>
      <Columns
        columns={columns}
        ticks={ticks}
        format={percent}
        height={NEGATIVE_HEIGHT}
        label="Доля негатива, столбцы по корзинам периода"
      />
    </section>
  );
}
