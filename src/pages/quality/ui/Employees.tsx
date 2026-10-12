'use client';

import { type ScoreTone, scoreTone } from '@/entities/evaluation';
import { formatCount } from '@/shared/lib/format';
import { kit } from '@/shared/ui/analytics-kit';
import type { QualityCallItem, QualityOperatorScore, QualityStageShare } from '../api/types';
import { operatorKey, operatorLabel } from '../model/operators';
import type { QualityState } from '../model/state';
import { type PreviousScores, TREND_LABEL, trendOf } from '../model/trend';
import { EmployeeCard } from './EmployeeCard';
import styles from './Employees.module.css';

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
 * Список оценок сотрудников по убыванию балла, как в макете заказчика.
 *
 * Строка выбирает сотрудника для всего экрана: недели, этапы, возражения,
 * итоги и список звонков пересчитываются по нему, а под списком открывается
 * его карточка. Повторный клик возвращает всех.
 *
 * Список берётся из сводки по всем сотрудникам, а не из текущей: после выбора
 * одного он иначе состоял бы из него одного, и сравнивать было бы не с кем.
 *
 * Динамика — к предыдущему периоду той же длины (`trendOf`). Подписи нет, пока
 * тот период не загружен и если у сотрудника в нём не было оценённых звонков.
 *
 * @param props Свойства компонента.
 * @param props.operators Сотрудники из сводки по всем.
 * @param props.stages Этапы скрипта: отсюда подписи для «слабого этапа».
 * @param props.previous Баллы за предыдущий период. `null` — ещё не загружены.
 * @param props.calls Звонки текущего охвата — при выбранном сотруднике это его звонки.
 * @param props.callsTotal Сколько звонков под охватом всего; `undefined` — ещё не известно.
 * @param props.state Состояние экрана.
 * @param props.onChange Вызывается с новым состоянием экрана.
 * @param props.onShowAll Перейти к полному списку звонков под блоками.
 * @returns Список сотрудников и, если один выбран, его карточка.
 */
export function Employees({
  operators,
  stages,
  previous,
  calls,
  callsTotal,
  state,
  onChange,
  onShowAll,
}: {
  operators: readonly QualityOperatorScore[];
  stages: readonly QualityStageShare[];
  previous: PreviousScores | null;
  calls: readonly QualityCallItem[];
  callsTotal: number | undefined;
  state: QualityState;
  onChange: (next: QualityState) => void;
  onShowAll: () => void;
}) {
  const rows = [...operators].sort(
    (a, b) => b.average_score - a.average_score || b.calls - a.calls,
  );
  const chosen = rows.find((operator) => operatorKey(operator) === state.operator);

  return (
    <>
      <section className={styles.employees} aria-label="Оценки сотрудников">
        <h2 className={kit.cardTitle}>Оценки сотрудников</h2>
        {rows.length === 0 ? (
          <p className={kit.hint}>За период нет звонков, оценённых по скрипту.</p>
        ) : (
          <ul className={styles.employeeList}>
            {rows.map((operator) => {
              const key = operatorKey(operator);
              const name = operatorLabel(operator);
              const tone = scoreTone(operator.average_score);
              const score = Math.round(operator.average_score);
              const before = previous?.scores.get(key);
              const trend = previous ? trendOf(operator.average_score, before) : null;
              return (
                <li key={key}>
                  <button
                    type="button"
                    className={styles.employeeRow}
                    aria-pressed={state.operator === key}
                    onClick={() =>
                      onChange({ ...state, operator: state.operator === key ? '' : key })
                    }
                  >
                    <span className={styles.employeeName} title={name}>
                      {name}
                    </span>
                    <span className={styles.employeeCalls}>
                      {formatCount(operator.calls, 'звонок', 'звонка', 'звонков')}
                    </span>
                    <span className={styles.employeeTrack} aria-hidden="true">
                      <span className={FILL[tone]} style={{ width: `${score}%` }} />
                    </span>
                    <span className={`${styles.employeeScore} ${TONE[tone]}`}>{score}%</span>
                    {/* Место под подпись занято всегда: без неё балл и полоса
                        съезжали бы от строки к строке. */}
                    <span
                      className={styles.employeeTrend}
                      title={
                        trend && before !== undefined && previous
                          ? `Было ${Math.round(before)}% за ${previous.label}`
                          : undefined
                      }
                    >
                      {trend ? TREND_LABEL[trend] : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {chosen ? (
        <EmployeeCard
          operator={chosen}
          stages={stages}
          previous={previous}
          calls={calls}
          callsTotal={callsTotal}
          onOpen={(call) => onChange({ ...state, call })}
          onShowAll={onShowAll}
        />
      ) : null}
    </>
  );
}
