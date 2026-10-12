'use client';

import type { QualitySummaryResponse } from '@/api/client';
import styles from '@/app/quality/quality.module.css';
import {
  type DonutOutcome,
  formatDay,
  OTHER_OBJECTIONS,
  objectionCards,
  outcomeDonut,
  percent,
  type QualityState,
  type ScoreTone,
  scoreTone,
  stageCounts,
} from '@/lib/quality';

const TONE: Record<ScoreTone, string | undefined> = {
  good: styles.good,
  fair: styles.fair,
  poor: styles.poor,
};

const FILL: Record<ScoreTone, string | undefined> = {
  good: styles.fillGood,
  fair: styles.fillFair,
  poor: styles.fillPoor,
};

/**
 * Корректность этапов — блок макета заказчика: по строке на этап скрипта,
 * полоса и процент цветом шкалы оценки.
 *
 * Процент — доля звонков, где этап засчитан. По правилу заказчика этап,
 * который не понадобился, засчитывается: у оператора, которому клиент не
 * возразил, нет повода отрабатывать возражение. Три числа раздельно —
 * выполнен, не выполнен, не понадобился — в подсказке строки и в
 * переключателе над списком звонков.
 *
 * Строка — заодно фильтр списка: звонки этого этапа, сначала те, где он не
 * выполнен. `who` — выбранный сотрудник: сводка уже посчитана по нему.
 */
export function Stages({
  summary,
  state,
  who,
  onChange,
}: {
  summary: QualitySummaryResponse;
  state: QualityState;
  who?: string;
  onChange: (next: QualityState) => void;
}) {
  const stages = summary.stages ?? [];
  return (
    <section className={styles.card} aria-label="Корректность этапов">
      <h2 className={styles.cardTitle}>Корректность этапов{who ? ` — ${who}` : ''}</h2>
      <p className={styles.periodNote}>
        Текущий период:{' '}
        <b>
          {formatDay(state.from)} – {formatDay(state.to)}
        </b>
      </p>
      <ol className={styles.stageRows}>
        {stages.map((stage, index) => {
          const counts = stageCounts(stage);
          const tone = scoreTone(stage.share * 100);
          return (
            <li key={stage.key}>
              <button
                type="button"
                className={styles.stageRow}
                aria-pressed={state.stage === stage.key}
                title={
                  `Выполнен ${counts.done}, не выполнен ${counts.failed}, ` +
                  `не понадобился ${counts.skipped}. Клик показывает звонки этапа`
                }
                onClick={() =>
                  onChange({
                    ...state,
                    stage: state.stage === stage.key ? '' : stage.key,
                    stageResult: 'failed',
                    skipped: false,
                    evaluationStatus: '',
                  })
                }
              >
                <span className={styles.num}>{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.stageLabel}>{stage.label}</span>
                <span className={styles.track} aria-hidden="true">
                  <span className={FILL[tone]} style={{ width: `${stage.share * 100}%` }} />
                </span>
                {stage.mandatory ? (
                  <span
                    className={styles.tag}
                    title="Обязательное условие: его пропуск считается нарушением"
                  >
                    чек-лист
                  </span>
                ) : null}
                <span className={`${styles.stagePct} ${TONE[tone]}`}>{percent(stage.share)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className={styles.footnote}>
        Если возражений не было — этап считается выполненным (1 пункт).
      </p>
    </section>
  );
}

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
 * Итог звонка: круговая диаграмма из трёх частей, как в макете заказчика, —
 * заявка, перезвон, отказ. В центре — доля заявок.
 *
 * Итогов в скрипте больше: «нет технической возможности» и «не определено» на
 * диаграмму не идут и стоят под ней, а их место на круге остаётся пустым. Доли
 * считаются от всех звонков по скрипту: иначе «заявка 50%» расходилась бы с
 * числом звонков в списке. Строка легенды — фильтр списка.
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
  const toggle = (key: string) =>
    onChange({
      ...state,
      outcome: state.outcome === key ? '' : key,
      skipped: false,
      evaluationStatus: '',
    });
  return (
    <section className={styles.card} aria-label="Итог звонка">
      <h2 className={styles.cardTitle}>Итог звонка</h2>
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
        <p className={styles.footnote}>
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

/**
 * Отработка возражений по типам: шесть карточек макета заказчика.
 *
 * Монохромно, как в макете: доля отработки — не балл оператора, и шкала
 * «плохо — хорошо» здесь обещала бы оценку, которой никто не ставил. Карточка
 * возражения, которое не звучало, остаётся на месте с прочерком: сетка не
 * должна менять раскладку от того, что встретилось в периоде.
 *
 * Возражений в скрипте больше шести. Остальные — строкой под сеткой: в макете
 * их нет, но молча убрать их с экрана значило бы спрятать часть разговоров.
 */
export function Objections({ summary }: { summary: QualitySummaryResponse }) {
  const cards = objectionCards(summary.objections ?? []);
  const other = cards.find((card) => card.key === OTHER_OBJECTIONS);
  return (
    <section className={styles.card} aria-label="Отработка возражений по типам">
      <h2 className={styles.cardTitle}>Отработка возражений — по типам</h2>
      <ul className={styles.objectionGrid}>
        {cards
          .filter((card) => card.key !== OTHER_OBJECTIONS)
          .map((card) => (
            <li
              key={card.key}
              className={styles.objectionCard}
              title={
                card.raised > 0 ? `Отработано ${card.handled} из ${card.raised}` : 'Не звучало'
              }
            >
              <span className={styles.objectionLabel}>{card.label}</span>
              <span className={styles.objectionValue}>
                <b>{card.share === null ? '—' : percent(card.share)}</b>
                <span>{card.share === null ? 'не звучало' : 'отработано'}</span>
              </span>
              <span className={styles.objectionBar} aria-hidden="true">
                {card.share ? <span style={{ width: `${card.share * 100}%` }} /> : null}
              </span>
            </li>
          ))}
      </ul>
      {other && other.raised > 0 ? (
        <p className={styles.footnote}>
          Прочие возражения — отработано {other.handled} из {other.raised}:{' '}
          {other.parts
            .map((part) => `«${part.label}» — ${part.handled} из ${part.raised}`)
            .join(', ')}
          .
        </p>
      ) : null}
    </section>
  );
}
