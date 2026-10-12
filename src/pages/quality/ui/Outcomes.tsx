'use client';

import { percent } from '@/shared/lib/format';
import { kit } from '@/shared/ui/analytics-kit';
import type { QualitySummaryResponse } from '../api/types';
import { type DonutOutcome, outcomeDonut } from '../model/outcomes';
import type { QualityState } from '../model/state';
import common from './common.module.css';
import styles from './Outcomes.module.css';

/** Цвета частей диаграммы — из макета: заявка, перезвон, отказ. */
const DONUT_COLOR: Record<DonutOutcome, string> = {
  request: 'var(--score-good)',
  callback: 'var(--score-fair)',
  refusal: 'var(--score-poor)',
};

const DONUT_TONE: Record<DonutOutcome, string | undefined> = {
  request: styles.good,
  callback: styles.fair,
  refusal: styles.poor,
};

const DONUT_DOT: Record<DonutOutcome, string | undefined> = {
  request: styles.fillGood,
  callback: styles.fillFair,
  refusal: styles.fillPoor,
};

/**
 * Блок «Итог звонка»: круговая диаграмма из трёх частей, как в макете заказчика, — заявка,
 * перезвон, отказ.
 *
 * В центре — доля заявок.
 *
 * Итогов в скрипте больше: «нет технической возможности» и «не определено» на
 * диаграмму не идут и стоят под ней, а их место на круге остаётся пустым. Доли
 * считаются от всех звонков по скрипту: иначе «заявка 50%» расходилась бы с
 * числом звонков в списке. Строка легенды — фильтр списка.
 *
 * @param props Свойства компонента.
 * @param props.summary Сводка оценок за период.
 * @param props.state Состояние экрана.
 * @param props.onChange Вызывается с новым состоянием экрана.
 * @returns Карточка с диаграммой, легендой и итогами вне диаграммы.
 */
export function Outcomes({
  summary,
  state,
  onChange,
}: {
  summary: QualitySummaryResponse;
  state: QualityState;
  onChange: (next: QualityState) => void;
}) {
  const donut = outcomeDonut(summary.outcomes ?? []);
  const requests = donut.parts.find((part) => part.key === 'request');
  const shown = donut.parts.reduce((sum, part) => sum + part.share, 0);
  const arcs = donut.parts
    .filter((part) => part.share > 0)
    .map(
      (part) =>
        `${DONUT_COLOR[part.key]} ${part.offset * 100}% ${(part.offset + part.share) * 100}%`,
    );
  // Остаток круга — итоги вне диаграммы: дорожка, а не четвёртый цвет.
  const gradient = `conic-gradient(${[...arcs, `var(--track) ${shown * 100}% 100%`].join(', ')})`;
  /**
   * Ставит или снимает отбор списка звонков по итогу.
   *
   * @param key Ключ итога.
   */
  const toggle = (key: string) =>
    onChange({
      ...state,
      outcome: state.outcome === key ? '' : key,
      skipped: false,
      evaluationStatus: '',
    });
  return (
    <section className={kit.card} aria-label="Итог звонка">
      <h2 className={kit.cardTitle}>Итог звонка</h2>
      <div className={styles.donutBox}>
        <div
          className={styles.donut}
          style={{ background: gradient }}
          role="img"
          aria-label={donut.parts.map((part) => `${part.label}: ${percent(part.share)}`).join(', ')}
        >
          <span className={styles.donutCenter}>
            <b>{summary.calls > 0 && requests ? percent(requests.share) : '—'}</b>
            <span>заявка</span>
          </span>
        </div>
        <ul className={styles.donutLegend}>
          {donut.parts.map((part) => (
            <li key={part.key}>
              <button
                type="button"
                className={styles.legendRow}
                aria-pressed={state.outcome === part.key}
                title={`Звонков: ${part.calls}. Клик показывает их в списке`}
                onClick={() => toggle(part.key)}
              >
                <span className={`${styles.legendDot} ${DONUT_DOT[part.key]}`} aria-hidden="true" />
                <span className={styles.legendLabel}>{part.label}</span>
                <span className={`${styles.legendPct} ${DONUT_TONE[part.key]}`}>
                  {percent(part.share)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {donut.rest.some((item) => item.calls > 0) ? (
        <p className={common.footnote}>
          Вне диаграммы:{' '}
          {donut.rest
            .filter((item) => item.calls > 0)
            .map((item, index) => (
              <span key={item.key}>
                {index > 0 ? ', ' : ''}
                <button
                  type="button"
                  className={styles.inlineButton}
                  aria-pressed={state.outcome === item.key}
                  onClick={() => toggle(item.key)}
                >
                  {item.label.toLowerCase()} — {item.calls}
                </button>
              </span>
            ))}
        </p>
      ) : null}
    </section>
  );
}
