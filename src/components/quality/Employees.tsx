'use client';

import type { QualityCallItem, QualityOperatorScore, QualityStageShare } from '@/api/client';
import styles from '@/app/quality/quality.module.css';
import { formatCount, formatDateTime, formatDuration } from '@/lib/format';
import {
  doneShare,
  operatorKey,
  operatorLabel,
  percent,
  type QualityState,
  qualityFailureMessage,
  type ScoreTone,
  scoreTone,
  TREND_LABEL,
  type Trend,
  trendOf,
  weakestStage,
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

const TREND_TONE: Record<Trend, string | undefined> = {
  up: styles.good,
  flat: undefined,
  down: styles.poor,
};

/** Сколько звонков сотрудника показано в карточке до «Показать весь список». */
export const PREVIEW_CALLS = 5;

/** Баллы сотрудников за предыдущий период той же длины: ключ сотрудника → средний балл. */
export type PreviousScores = { label: string; scores: ReadonlyMap<string, number> };

/**
 * Оценки сотрудников: список по убыванию балла, как в макете заказчика.
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
  /** Этапы скрипта: отсюда подписи для «слабого этапа». */
  stages: readonly QualityStageShare[];
  /** Баллы за предыдущий период. `null` — ещё не загружены. */
  previous: PreviousScores | null;
  /** Звонки текущего охвата — при выбранном сотруднике это его звонки. */
  calls: readonly QualityCallItem[];
  callsTotal: number | undefined;
  state: QualityState;
  onChange: (next: QualityState) => void;
  /** Перейти к полному списку звонков под блоками. */
  onShowAll: () => void;
}) {
  const rows = [...operators].sort(
    (a, b) => b.average_score - a.average_score || b.calls - a.calls,
  );
  const chosen = rows.find((operator) => operatorKey(operator) === state.operator);

  return (
    <>
      <section className={styles.employees} aria-label="Оценки сотрудников">
        <h2 className={styles.cardTitle}>Оценки сотрудников</h2>
        {rows.length === 0 ? (
          <p className={styles.hint}>За период нет звонков, оценённых по скрипту.</p>
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

/**
 * Карточка выбранного сотрудника из макета: четыре показателя — балл, число
 * звонков, динамика, слабый этап — и его разговоры.
 *
 * Разговоров — первые пять; остальные в списке звонков под блоками, куда ведёт
 * кнопка: там же отбор и порядок, и второй полный список здесь только
 * дублировал бы его. «Открыть звонок» открывает разбор — запись, разговор по
 * ролям и оценку каждого этапа.
 */
function EmployeeCard({
  operator,
  stages,
  previous,
  calls,
  callsTotal,
  onOpen,
  onShowAll,
}: {
  operator: QualityOperatorScore;
  stages: readonly QualityStageShare[];
  previous: PreviousScores | null;
  calls: readonly QualityCallItem[];
  callsTotal: number | undefined;
  onOpen: (callId: string) => void;
  onShowAll: () => void;
}) {
  const name = operatorLabel(operator);
  const labels = new Map(stages.map((stage) => [stage.key, stage.label]));
  const weakest = weakestStage(
    (operator.stages ?? []).map((stage) => ({
      ...stage,
      label: labels.get(stage.key) ?? stage.key,
    })),
  );
  const weakestShare = weakest ? doneShare(weakest.applicable, weakest.failed) : null;
  const before = previous?.scores.get(operatorKey(operator));
  const trend = previous ? trendOf(operator.average_score, before) : null;

  return (
    <section className={styles.card} aria-label={`Статистика — ${name}`}>
      <h2 className={styles.cardTitle}>Статистика — {name}</h2>
      <dl className={styles.metrics}>
        <div className={styles.metric}>
          <dt>Общий балл</dt>
          <dd className={TONE[scoreTone(operator.average_score)]}>
            {Math.round(operator.average_score)}%
          </dd>
        </div>
        <div className={styles.metric}>
          <dt>Звонков оценено</dt>
          <dd>{operator.calls}</dd>
        </div>
        <div className={styles.metric}>
          <dt>Динамика</dt>
          {trend && before !== undefined && previous ? (
            <dd
              className={TREND_TONE[trend]}
              title={`Было ${Math.round(before)}% за ${previous.label}`}
            >
              {TREND_LABEL[trend]}
            </dd>
          ) : (
            <dd className={styles.metricText}>
              {previous ? 'нет звонков в прошлом периоде' : '…'}
            </dd>
          )}
        </div>
        <div className={styles.metric}>
          <dt>Слабый этап</dt>
          {weakest && weakestShare !== null ? (
            <dd className={styles.metricText}>
              {weakest.label}{' '}
              <span className={TONE[scoreTone(weakestShare * 100)]}>{percent(weakestShare)}</span>
            </dd>
          ) : (
            <dd className={styles.metricText}>нет: все этапы выполнены</dd>
          )}
        </div>
      </dl>
      <hr className={styles.divider} />
      <h3 className={styles.kickerMuted}>
        Разговоры за выбранный период{callsTotal === undefined ? '' : ` — ${callsTotal} всего`}
      </h3>
      {callsTotal === 0 ? (
        <p className={styles.hint}>Нет звонков за выбранный период у этого сотрудника.</p>
      ) : (
        <ul className={styles.previewList}>
          {calls.slice(0, PREVIEW_CALLS).map((call) => (
            <li key={call.call_id} className={styles.previewCall}>
              <div className={styles.previewHead}>
                <span className={styles.previewDate}>{formatDateTime(call.started_at)}</span>
                <span className={styles.previewDuration}>{formatDuration(call.duration_s)}</span>
                {call.outcome_label ? (
                  <span className={styles.previewChip}>{call.outcome_label}</span>
                ) : null}
                <span className={styles.spacer} />
                {typeof call.score === 'number' ? (
                  <span className={`${styles.previewScore} ${TONE[scoreTone(call.score)]}`}>
                    {call.score}%
                  </span>
                ) : (
                  <span className={styles.previewNoScore}>без балла</span>
                )}
              </div>
              <PreviewNote call={call} />
              <button
                type="button"
                className={styles.previewOpen}
                onClick={() => onOpen(call.call_id)}
              >
                Открыть звонок →
              </button>
            </li>
          ))}
        </ul>
      )}
      {callsTotal !== undefined && callsTotal > PREVIEW_CALLS ? (
        <button type="button" className={styles.previewAll} onClick={onShowAll}>
          Показать весь список ({callsTotal})
        </button>
      ) : null}
    </section>
  );
}

/** Строка под шапкой звонка: итог словами, а у звонка без балла — почему его нет. */
function PreviewNote({ call }: { call: QualityCallItem }) {
  const failure =
    call.evaluation_status === 'failed'
      ? (qualityFailureMessage(`quality_${call.failure_reason ?? ''}`) ?? 'Не удалось оценить.')
      : call.evaluation_status === 'pending'
        ? 'Ожидает оценки.'
        : call.evaluation_status === 'unavailable'
          ? 'Нет расшифровки — оценить нельзя.'
          : null;
  const text = failure ?? call.summary;
  return text ? <p className={styles.previewQuote}>{text}</p> : null;
}
