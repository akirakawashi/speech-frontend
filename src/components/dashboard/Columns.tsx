'use client';

import { useId, useState } from 'react';
import styles from '@/app/dashboard.module.css';

export type Segment = {
  key: string;
  label: string;
  /** Цвет заливки — переменная палитры или готовый цвет. */
  color: string;
  value: number;
  /** Значение словами для подсказки: `34` или `12%`. */
  text: string;
};

export type Column = {
  key: string;
  /** Подпись под столбцом. */
  label: string;
  /** Заголовок подсказки и строки таблицы: полный диапазон корзины. */
  title: string;
  /** Сумма сегментов — высота столбца. `null` — значения нет вовсе. */
  total: number | null;
  /** Число над столбцом и в подсказке. */
  caption: string;
  segments: Segment[];
};

/**
 * Просвет между сегментами: два пикселя, пока столбцу есть из чего их отдать.
 * У низкого столбца — неполный день, редкая корзина — просветы заняли бы
 * больше места, чем сами сегменты, и столбец читался бы выше, чем он есть.
 */
function segmentGap(column: Column, top: number, height: number): number {
  const parts = column.segments.filter((segment) => segment.value > 0).length;
  const pixels = ((column.total ?? 0) / top) * height;
  if (parts < 2 || pixels >= parts * 8) return 2;
  return pixels >= parts * 3 ? 1 : 0;
}

/** Больше столбцов — подписи над ними и под каждым не помещаются. */
const DENSE = 24;

/**
 * Столбцы по корзинам периода — общая основа графика тем и графика негатива.
 * Оба стоят друг под другом на одних и тех же корзинах, поэтому геометрия у
 * них одна: столбец под столбцом.
 *
 * Столбец тонкий и растёт от общей оси; сегменты разделены просветом в цвет
 * карточки, а не обводкой. Число над столбцом — пока столбцов немного; дальше
 * его несут шкала и подсказка. Подсказка открывается наведением и фокусом и
 * перечисляет все сегменты корзины — целиться в тонкий сегмент не нужно.
 *
 * Подписи тем приходят из классификатора, который правят люди: они вставляются
 * текстом, разметкой не становятся.
 */
export function Columns({
  columns,
  ticks,
  format,
  height,
  label,
}: {
  columns: Column[];
  /** Деления шкалы от нуля; последнее — её верх. */
  ticks: number[];
  /** Подпись деления шкалы. */
  format: (tick: number) => string;
  height: number;
  /** Что на графике — для экранного диктора. */
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  // Графиков на экране два, и подсказка у каждого своя: общий идентификатор
  // связал бы столбец одного с подсказкой другого.
  const tooltipId = useId();
  const top = ticks.at(-1) || 1;
  const dense = columns.length > DENSE;
  // Подпись — не под каждым столбцом, если их много: иначе даты слипаются.
  const every = Math.max(1, Math.ceil(columns.length / 16));
  const shown = active === null ? null : columns[active];

  return (
    <figure className={styles.chart} aria-label={label}>
      <div className={styles.axis} style={{ height }} aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick} className={styles.tick} style={{ bottom: `${(tick / top) * 100}%` }}>
            {format(tick)}
          </span>
        ))}
      </div>
      <div className={styles.plot}>
        <div className={styles.field} style={{ height }}>
          {ticks.map((tick) => (
            <span
              key={tick}
              className={styles.gridline}
              style={{ bottom: `${(tick / top) * 100}%` }}
              aria-hidden="true"
            />
          ))}
          <ul className={styles.columns}>
            {columns.map((column, index) => (
              <li key={column.key} className={styles.slot}>
                <button
                  type="button"
                  className={styles.column}
                  aria-label={`${column.title}: ${column.caption}`}
                  aria-describedby={active === index ? tooltipId : undefined}
                  onPointerEnter={() => setActive(index)}
                  onPointerLeave={() => setActive((now) => (now === index ? null : now))}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive((now) => (now === index ? null : now))}
                >
                  {dense || column.total === null ? null : (
                    <span className={styles.cap}>{column.caption}</span>
                  )}
                  <span
                    className={styles.bar}
                    style={{
                      height: `${((column.total ?? 0) / top) * 100}%`,
                      gap: segmentGap(column, top, height),
                    }}
                    aria-hidden="true"
                  >
                    {column.segments
                      .filter((segment) => segment.value > 0)
                      .map((segment) => (
                        <span
                          key={segment.key}
                          className={styles.segment}
                          style={{
                            // Доля от суммы столбца, а не само значение: сумма
                            // `flex-grow` меньше единицы (доля негатива — 0,3)
                            // оставила бы столбец заполненным на треть.
                            flexGrow: segment.value / (column.total || 1),
                            background: segment.color,
                          }}
                        />
                      ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {shown && active !== null ? (
            <div
              id={tooltipId}
              role="tooltip"
              className={styles.tooltip}
              // Сбоку от полосы корзины, а не поверх столбца, который читают;
              // в правой половине — слева, чтобы не уйти за карточку. Столбец
              // один — сбоку места нет: подсказка встаёт к правому краю поля.
              style={
                columns.length === 1
                  ? { right: 0 }
                  : active < columns.length / 2
                    ? { left: `${((active + 1) / columns.length) * 100}%` }
                    : { right: `${((columns.length - active) / columns.length) * 100}%` }
              }
            >
              <span className={styles.tooltipTitle}>{shown.title}</span>
              <span className={styles.tooltipTotal}>{shown.caption}</span>
              {shown.segments.length > 1
                ? shown.segments
                    .filter((segment) => segment.value > 0)
                    .map((segment) => (
                      <span key={segment.key} className={styles.tooltipRow}>
                        <span
                          className={styles.key}
                          style={{ background: segment.color }}
                          aria-hidden="true"
                        />
                        <b>{segment.text}</b>
                        <span>{segment.label}</span>
                      </span>
                    ))
                : null}
            </div>
          ) : null}
        </div>
        <ul className={styles.names} aria-hidden="true">
          {columns.map((column, index) => (
            <li key={column.key} className={styles.name}>
              {index % every === 0 ? column.label : ''}
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
