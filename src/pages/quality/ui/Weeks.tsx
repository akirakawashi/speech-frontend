'use client';

import { type ScoreTone, scoreTone } from '@/entities/evaluation';
import { formatDay, type Period, periodLabel } from '@/shared/lib/date';
import { percent } from '@/shared/lib/format';
import { kit } from '@/shared/ui/analytics-kit';
import type { QualitySummaryResponse } from '../api/types';
import type { QualityState } from '../model/state';
import { weekPeriod } from '../model/weeks';
import styles from './Weeks.module.css';

const FILL: Record<ScoreTone, string | undefined> = {
  good: styles.fillGood,
  fair: styles.fillFair,
  poor: styles.fillPoor,
};

/**
 * Блок «Доля полностью корректных звонков по неделям» — главный показатель макета заказчика.
 *
 * Полностью корректный звонок — тот, где засчитаны все этапы.
 *
 * Вид — из макета: столбцы во всю высоту блока, цвет по шкале оценки, процент
 * над столбцом. Столбец — заодно шаг внутрь: клик ставит период на эту неделю,
 * и весь экран пересчитывается по ней. Обратно ведёт кнопка в шапке блока:
 * период до клика помнит экран, иначе вернуться можно было бы только руками.
 *
 * @param props Свойства компонента.
 * @param props.summary Сводка оценок за период.
 * @param props.state Состояние экрана.
 * @param props.who Выбранный сотрудник: числа блока посчитаны по нему.
 * @param props.outer Период, с которого зашли в неделю. `null` — в неделю не заходили.
 * @param props.onPick Вызывается с частью недели, по столбцу которой кликнули.
 * @param props.onBack Возвращает период, с которого зашли в неделю.
 * @returns Карточка со столбцами по неделям.
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
  who?: string;
  outer: Period | null;
  onPick: (week: Period) => void;
  onBack: () => void;
}) {
  const weeks = summary.weeks ?? [];
  return (
    <section className={kit.card} aria-label="Полностью корректные звонки по неделям">
      <div className={kit.cardHead}>
        <h2 className={kit.cardTitle}>
          % полностью корректных звонков — по неделям{who ? ` — ${who}` : ''}
        </h2>
        {outer ? (
          <button type="button" className={kit.ghost} onClick={onBack}>
            ← к периоду {periodLabel(outer)}
          </button>
        ) : null}
      </div>
      {weeks.length === 0 ? (
        <p className={kit.hint}>За период нет звонков, оценённых по скрипту.</p>
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
