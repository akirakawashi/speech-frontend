'use client';

import { useState } from 'react';
import type { DashboardResponse } from '@/api/client';
import styles from '@/app/dashboard.module.css';
import quality from '@/app/quality/quality.module.css';
import {
  axisTicks,
  bucketLabel,
  bucketSpan,
  count,
  GRAIN_LABEL,
  inSlotOrder,
  OTHER_THEME,
  themeSlots,
} from '@/lib/dashboard';
import { percent } from '@/lib/quality';
import { type Column, Columns } from './Columns';

/** Высота поля графика тем и графика негатива под ним. */
const THEMES_HEIGHT = 260;
const NEGATIVE_HEIGHT = 96;

const GRAIN_WORD = { day: 'дням', week: 'неделям', month: 'месяцам' } as const;

/** Цвет места палитры; «Прочее» — нейтральный. */
export function themeColor(key: string, slots: Map<string, number>): string {
  if (key === OTHER_THEME) return 'var(--series-other)';
  return `var(--series-${(slots.get(key) ?? 0) + 1})`;
}

function spansYears(data: DashboardResponse): boolean {
  return data.first_day.slice(0, 4) !== data.last_day.slice(0, 4);
}

/**
 * Обращения по темам во времени: столбец — корзина периода, сегменты — темы.
 *
 * Легенда есть всегда и несёт долю темы за период; в столбце подписана только
 * его сумма. Процент в каждом сегменте, как в макете, на тонком столбце не
 * помещается — эти числа отдают подсказка и таблица. Таблица — тот же график
 * цифрами: её читает диктор и тот, кому нужны точные значения.
 */
export function ThemeChart({ data }: { data: DashboardResponse }) {
  const [asTable, setAsTable] = useState(false);
  const themes = data.themes ?? [];
  const buckets = data.buckets ?? [];
  const slots = themeSlots(themes);
  const ordered = inSlotOrder(themes);
  const position = new Map(themes.map((theme, index) => [theme.key, index]));
  const withYear = spansYears(data);

  const columns: Column[] = buckets.map((bucket) => {
    const span = { from: bucket.start, to: bucket.end };
    return {
      key: bucket.start,
      label: bucketLabel(span, data.grain, withYear),
      title: bucketSpan(span),
      total: bucket.calls,
      caption: count(bucket.calls),
      segments: ordered.map((theme) => {
        const calls = bucket.by_theme?.[position.get(theme.key) ?? -1] ?? 0;
        return {
          key: theme.key,
          label: theme.label,
          color: themeColor(theme.key, slots),
          value: calls,
          text: count(calls),
        };
      }),
    };
  });
  const ticks = axisTicks(Math.max(0, ...buckets.map((bucket) => bucket.calls)));

  return (
    <section className={quality.card} aria-label="Обращения по темам">
      <div className={quality.cardHead}>
        <h2 className={quality.cardTitle}>Обращения по темам — по {GRAIN_WORD[data.grain]}</h2>
        {data.calls > 0 ? (
          <button
            type="button"
            className={quality.ghost}
            aria-pressed={asTable}
            onClick={() => setAsTable((now) => !now)}
          >
            {asTable ? 'График' : 'Таблица'}
          </button>
        ) : null}
      </div>
      {data.calls === 0 ? (
        <p className={quality.hint}>За период нет разобранных обращений с темой.</p>
      ) : (
        <>
          <ul className={styles.legend}>
            {ordered.map((theme) => (
              <li key={theme.key}>
                <span
                  className={styles.swatch}
                  style={{ background: themeColor(theme.key, slots) }}
                  aria-hidden="true"
                />
                {theme.label} <b>{percent(theme.share)}</b>
              </li>
            ))}
          </ul>
          {asTable ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{GRAIN_LABEL[data.grain]}</th>
                    {ordered.map((theme) => (
                      <th key={theme.key} scope="col">
                        {theme.label}
                      </th>
                    ))}
                    <th scope="col">Всего</th>
                    <th scope="col">Негатив</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((bucket, index) => (
                    <tr key={bucket.start}>
                      <td>{columns[index]?.title}</td>
                      {columns[index]?.segments.map((segment) => (
                        <td key={segment.key}>{segment.text}</td>
                      ))}
                      <td>{count(bucket.calls)}</td>
                      <td>
                        {bucket.negative_share === null || bucket.negative_share === undefined
                          ? '—'
                          : percent(bucket.negative_share)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Columns
              columns={columns}
              ticks={ticks}
              format={count}
              height={THEMES_HEIGHT}
              label="Обращения по темам, столбцы по корзинам периода"
            />
          )}
        </>
      )}
    </section>
  );
}

/**
 * Доля негатива по тем же корзинам — строго под графиком тем: столбец под
 * столбцом. Отдельный график, а не вторая шкала на первом: у числа обращений и
 * у доли нет общей оси, и совмещённые они показывали бы связь, которой нет.
 *
 * Ряд один, поэтому легенды нет — что на графике, говорит заголовок. Корзина
 * без звонков с тональностью стоит пустой: ноль значил бы «негатива нет».
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
    <section className={quality.card} aria-label="Доля негатива по корзинам периода">
      <div className={quality.cardHead}>
        <h2 className={quality.cardTitle}>Доля негатива — по {GRAIN_WORD[data.grain]}</h2>
        <span className={quality.hint}>по всем темам</span>
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
