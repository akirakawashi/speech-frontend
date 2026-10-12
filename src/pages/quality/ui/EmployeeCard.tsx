'use client';

import { qualityFailureMessage, type ScoreTone, scoreTone } from '@/entities/evaluation';
import { formatDateTime, formatDuration, percent } from '@/shared/lib/format';
import { kit } from '@/shared/ui/analytics-kit';
import type { QualityCallItem, QualityOperatorScore, QualityStageShare } from '../api/types';
import { operatorKey, operatorLabel } from '../model/operators';
import { doneShare, weakestStage } from '../model/stages';
import { type PreviousScores, TREND_LABEL, type Trend, trendOf } from '../model/trend';
import styles from './EmployeeCard.module.css';

const TONE: Record<ScoreTone, string | undefined> = {
  good: styles.good,
  fair: styles.fair,
  poor: styles.poor,
};

const TREND_TONE: Record<Trend, string | undefined> = {
  up: styles.good,
  flat: undefined,
  down: styles.poor,
};

/** Сколько звонков сотрудника показано в карточке до «Показать весь список». */
export const PREVIEW_CALLS = 5;

/**
 * Карточка выбранного сотрудника из макета: четыре показателя и его разговоры.
 *
 * Разговоров — первые пять; остальные в списке звонков под блоками, куда ведёт
 * кнопка: там же отбор и порядок, и второй полный список здесь только
 * дублировал бы его. «Открыть звонок» открывает разбор — запись, разговор по
 * ролям и оценку каждого этапа.
 *
 * @param props Свойства компонента.
 * @param props.operator Выбранный сотрудник.
 * @param props.stages Этапы скрипта: отсюда подписи для «слабого этапа».
 * @param props.previous Баллы за предыдущий период; `null` — ещё не загружены.
 * @param props.calls Звонки сотрудника за период.
 * @param props.callsTotal Сколько у него звонков всего; `undefined` — ещё не известно.
 * @param props.onOpen Вызывается с идентификатором звонка, который надо открыть в разборе.
 * @param props.onShowAll Переводит к полному списку звонков под блоками.
 * @returns Карточка с показателями и первыми пятью разговорами.
 */
export function EmployeeCard({
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
    <section className={kit.card} aria-label={`Статистика — ${name}`}>
      <h2 className={kit.cardTitle}>Статистика — {name}</h2>
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
        <p className={kit.hint}>Нет звонков за выбранный период у этого сотрудника.</p>
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
                <span className={kit.spacer} />
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

/**
 * Строка под шапкой звонка: итог словами, а у звонка без балла — почему его нет.
 *
 * @param props Свойства компонента.
 * @param props.call Звонок списка.
 * @returns Абзац с текстом или `null`, если сказать нечего.
 */
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
