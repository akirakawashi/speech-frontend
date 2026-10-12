'use client';

import type { QualitySummaryResponse } from '@/api/client';
import styles from '@/app/quality/quality.module.css';
import {
  formatDay,
  type Period,
  percent,
  periodLabel,
  type QualityState,
  type ScoreTone,
  scoreTone,
  weekPeriod,
} from '@/lib/quality';

const FILL: Record<ScoreTone, string | undefined> = {
  good: styles.fillGood,
  fair: styles.fillFair,
  poor: styles.fillPoor,
};

/**
 * Доля полностью корректных звонков по неделям — главный показатель макета
 * заказчика. Полностью корректный звонок — тот, где засчитаны все этапы.
 *
 * Вид — из макета: столбцы во всю высоту блока, цвет по шкале оценки, процент
 * над столбцом. Столбец — заодно шаг внутрь: клик ставит период на эту неделю,
 * и весь экран пересчитывается по ней. Обратно ведёт кнопка в шапке блока:
 * период до клика помнит экран, иначе вернуться можно было бы только руками.
 */
export function Weeks({
  summary,
  state,
  who,
  outer,
  onPick,
  onBack,
}: {
  summary: QualitySummaryResponse;
  state: QualityState;
  /** Выбранный сотрудник: числа блока посчитаны по нему. */
  who?: string;
  /** Период, с которого зашли в неделю. `null` — в неделю не заходили. */
  outer: Period | null;
  onPick: (week: Period) => void;
  onBack: () => void;
}) {
  const weeks = summary.weeks ?? [];
  return (
    <section className={styles.card} aria-label="Полностью корректные звонки по неделям">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>
          % полностью корректных звонков — по неделям{who ? ` — ${who}` : ''}
        </h2>
        {outer ? (
          <button type="button" className={styles.ghost} onClick={onBack}>
            ← к периоду {periodLabel(outer)}
          </button>
        ) : null}
      </div>
      {weeks.length === 0 ? (
        <p className={styles.hint}>За период нет звонков, оценённых по скрипту.</p>
      ) : (
        <ul className={styles.weekChart}>
          {weeks.map((week) => {
            const period = weekPeriod(week.week_start, state);
            const share = week.fully_correct_share;
            return (
              <li key={week.week_start} className={styles.weekItem}>
                <button
                  type="button"
                  className={styles.weekColumn}
                  aria-pressed={period.from === state.from && period.to === state.to}
                  aria-label={
                    `Неделя ${periodLabel(period)}: полностью корректных ` +
                    `${week.fully_correct} из ${week.calls}, ${percent(share)}`
                  }
                  title={
                    `${week.fully_correct} из ${week.calls} звонков. ` +
                    'Клик ставит период на эту неделю'
                  }
                  onClick={() => onPick(period)}
                >
                  <span className={styles.weekValue}>{percent(share)}</span>
                  {/* Высота — доля от места под столбец: 44px занимают процент
                      над ним и дата под ним. */}
                  <span
                    className={`${styles.weekBar} ${FILL[scoreTone(share * 100)]}`}
                    style={{ height: `calc((100% - 44px) * ${share})` }}
                    aria-hidden="true"
                  />
                  <span className={styles.weekName}>{formatDay(period.from).slice(0, 5)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
