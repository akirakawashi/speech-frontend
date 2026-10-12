'use client';

import { useState } from 'react';
import { percent } from '@/shared/lib/format';
import { kit } from '@/shared/ui/analytics-kit';
import type { DashboardResponse } from '../api/types';
import { GRAIN_WORD, spansYears, themeColor } from '../model/chart';
import {
  axisTicks,
  bucketLabel,
  bucketSpan,
  count,
  GRAIN_LABEL,
  inSlotOrder,
  themeSlots,
} from '../model/dashboard';
import { type Column, Columns } from './Columns';
import common from './common.module.css';
import styles from './ThemeChart.module.css';

/** Высота поля графика тем и графика негатива под ним. */
const THEMES_HEIGHT = 260;

/**
 * Рисует обращения по темам во времени: столбец — корзина периода, сегменты — темы.
 *
 * Легенда есть всегда и несёт долю темы за период; в столбце подписана только
 * его сумма. Процент в каждом сегменте, как в макете, на тонком столбце не
 * помещается — эти числа отдают подсказка и таблица. Таблица — тот же график
 * цифрами: её читает диктор и тот, кому нужны точные значения.
 *
 * @param props Свойства компонента.
 * @param props.data Ответ дашборда.
 * @returns Карточка с легендой и графиком или таблицей.
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
    <section className={kit.card} aria-label="Обращения по темам">
      <div className={kit.cardHead}>
        <h2 className={kit.cardTitle}>Обращения по темам — по {GRAIN_WORD[data.grain]}</h2>
        {data.calls > 0 ? (
          <button
            type="button"
            className={kit.ghost}
            aria-pressed={asTable}
            onClick={() => setAsTable((now) => !now)}
          >
            {asTable ? 'График' : 'Таблица'}
          </button>
        ) : null}
      </div>
      {data.calls === 0 ? (
        <p className={kit.hint}>За период нет разобранных обращений с темой.</p>
      ) : (
        <>
          <ul className={styles.legend}>
            {ordered.map((theme) => (
              <li key={theme.key}>
                <span
                  className={common.swatch}
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
