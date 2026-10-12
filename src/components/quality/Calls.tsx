'use client';

import type { QualityCallItem, QualityOutcomeShare, QualityStageShare } from '@/api/client';
import styles from '@/app/quality/quality.module.css';
import { formatCount, formatDateTime, formatDuration } from '@/lib/format';
import {
  BUCKET_LABEL,
  type Bucket,
  type CallSort,
  clearListFilter,
  hasListFilter,
  type QualityState,
  qualityFailureMessage,
  SORT_LABEL,
  SORTS,
  STAGE_STATE_LABEL,
  STAGE_STATES,
  type StageState,
  stageCounts,
  stageState,
} from '@/lib/quality';

const SCORE: Record<Bucket, string | undefined> = {
  good: styles.scoreGood,
  fair: styles.scoreFair,
  poor: styles.scorePoor,
};

const DOT: Record<StageState, string | undefined> = {
  done: styles.dotDone,
  failed: styles.dotFailed,
  skipped: styles.dotSkipped,
};

/** Знак рядом с цветом: галочка, крестик и точка различимы и без него. */
const GLYPH: Record<StageState, string> = { done: '✓', failed: '✗', skipped: '·' };

function isBucket(value: string | null | undefined): value is Bucket {
  return value === 'good' || value === 'fair' || value === 'poor';
}

/**
 * Звонки периода: балл, полоска этапов и пояснение модели в одной строке.
 *
 * По умолчанию худшие сверху — список открывают, чтобы найти, что разбирать.
 * Полоска показывает звонок без открытия: десять клеток в порядке скрипта.
 * Клик по строке открывает разбор со словами оператора.
 */
export function Calls({
  items,
  total,
  stages,
  outcomes,
  state,
  onChange,
  pending,
  failed,
  hasMore,
  loadingMore,
  onMore,
}: {
  items: readonly QualityCallItem[];
  total: number | undefined;
  stages: readonly QualityStageShare[];
  outcomes: readonly QualityOutcomeShare[];
  state: QualityState;
  onChange: (next: QualityState) => void;
  pending: boolean;
  failed: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
}) {
  const stageLabel = new Map(stages.map((stage) => [stage.key, stage.label]));
  const picked = stages.find((stage) => stage.key === state.stage);
  const outcomeLabel = new Map(outcomes.map((outcome) => [outcome.key, outcome.label]));

  const chips: { key: string; text: string; next: QualityState }[] = [];
  if (state.evaluationStatus) {
    chips.push({
      key: 'status',
      text: state.evaluationStatus === 'failed' ? 'Не удалось оценить' : 'Ожидают оценки',
      next: { ...state, evaluationStatus: '' },
    });
  }
  if (state.skipped) {
    chips.push({ key: 'skipped', text: 'Не по скрипту', next: { ...state, skipped: false } });
  }
  if (state.bucket) {
    chips.push({
      key: 'bucket',
      text: BUCKET_LABEL[state.bucket],
      next: { ...state, bucket: '' },
    });
  }
  if (state.outcome) {
    chips.push({
      key: 'outcome',
      text: `Итог: ${outcomeLabel.get(state.outcome) ?? state.outcome}`,
      next: { ...state, outcome: '' },
    });
  }
  if (state.violations) {
    chips.push({
      key: 'violations',
      text: 'Нарушено обязательное условие',
      next: { ...state, violations: false },
    });
  }

  return (
    <section className={`${styles.card} ${styles.listCard}`} aria-label="Звонки">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>
          Звонки
          {total !== undefined ? (
            <span className={styles.muted}>
              {' '}
              · {formatCount(total, 'звонок', 'звонка', 'звонков')}
            </span>
          ) : null}
        </h2>
        {state.skipped ? null : (
          <label className={styles.field}>
            <span className={styles.srOnly}>Порядок</span>
            <select
              className={styles.control}
              value={state.sort}
              onChange={(event) => onChange({ ...state, sort: event.target.value as CallSort })}
            >
              {SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {SORT_LABEL[sort]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {hasListFilter(state) ? (
        <div className={styles.listTools}>
          {picked ? (
            // Этап — не метка, а переключатель: тот же этап смотрят и там, где
            // он не выполнен, и там, где выполнен образцово.
            <div className={styles.segmented}>
              <span className={styles.segmentedLabel} title={picked.label}>
                {picked.label}:
              </span>
              {STAGE_STATES.map((result) => (
                <button
                  type="button"
                  key={result}
                  className={styles.segment}
                  aria-pressed={state.stageResult === result}
                  onClick={() => onChange({ ...state, stageResult: result })}
                >
                  {STAGE_STATE_LABEL[result]} · {stageCounts(picked)[result]}
                </button>
              ))}
              <button
                type="button"
                className={styles.segment}
                aria-label="Убрать отбор по этапу"
                title="убрать отбор"
                onClick={() => onChange({ ...state, stage: '', stageResult: 'failed' })}
              >
                ✕
              </button>
            </div>
          ) : null}
          {chips.map((chip) => (
            <button
              type="button"
              key={chip.key}
              className={styles.chip}
              title="убрать отбор"
              onClick={() => onChange(chip.next)}
            >
              {chip.text} <span aria-hidden="true">✕</span>
            </button>
          ))}
          {chips.length + (picked ? 1 : 0) > 1 ? (
            <button
              type="button"
              className={styles.reset}
              onClick={() => onChange(clearListFilter(state))}
            >
              сбросить всё
            </button>
          ) : null}
        </div>
      ) : null}

      {failed ? (
        <p className={`${styles.notice} ${styles.alert}`} role="alert">
          Не удалось загрузить звонки.
        </p>
      ) : pending ? (
        <p className={styles.notice}>Загружаем звонки…</p>
      ) : items.length === 0 ? (
        <p className={styles.notice}>
          {hasListFilter(state)
            ? 'Под отбор не попал ни один звонок.'
            : 'За период нет записей звонков.'}
        </p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.call_id}>
              <button
                type="button"
                className={styles.callRow}
                aria-current={state.call === item.call_id ? 'true' : undefined}
                onClick={() => onChange({ ...state, call: item.call_id })}
              >
                {isBucket(item.bucket) ? (
                  <span className={`${styles.score} ${SCORE[item.bucket]}`}>{item.score}%</span>
                ) : (
                  <span className={`${styles.score} ${styles.scoreNone}`}>—</span>
                )}
                <span className={styles.callBody}>
                  <span className={styles.callMeta}>
                    <span className={styles.callWho}>
                      {item.operator_name || item.operator_login || 'Без оператора'}
                    </span>
                    <span>{formatDateTime(item.started_at)}</span>
                    <span>{formatDuration(item.duration_s)}</span>
                    {item.outcome_label ? <span>{item.outcome_label}</span> : null}
                    {item.violation ? <span className={styles.violation}>нарушение</span> : null}
                  </span>
                  {item.evaluation_status === 'failed' ? (
                    <span className={styles.stripNote}>Не удалось оценить</span>
                  ) : item.evaluation_status === 'pending' ? (
                    <span className={styles.stripNote}>Ожидает оценки</span>
                  ) : item.evaluation_status === 'unavailable' ? (
                    <span className={styles.stripNote}>Нет расшифровки — оценить нельзя</span>
                  ) : item.script_applies ? (
                    <Strip item={item} labels={stageLabel} />
                  ) : (
                    <span className={styles.stripNote}>вне скрипта — не оценивался</span>
                  )}
                  {item.evaluation_status === 'failed' ? (
                    <span className={styles.callNote}>
                      {qualityFailureMessage(`quality_${item.failure_reason ?? ''}`)}
                    </span>
                  ) : item.summary ? (
                    <span className={styles.callNote}>{item.summary}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
          {hasMore ? (
            <li className={styles.moreRow}>
              <button type="button" className={styles.more} disabled={loadingMore} onClick={onMore}>
                {loadingMore ? 'Загружаем…' : `Показать ещё · показано ${items.length} из ${total}`}
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

/** Десять клеток в порядке скрипта и число невыполненных словами. */
function Strip({ item, labels }: { item: QualityCallItem; labels: ReadonlyMap<string, string> }) {
  const stages = item.stages ?? [];
  const missed = item.failed_stages ?? [];
  return (
    <span className={styles.strip}>
      {stages.map((stage, index) => {
        const state = stageState(stage);
        return (
          <span
            key={stage.key}
            className={`${styles.dot} ${DOT[state]}`}
            title={`${String(index + 1).padStart(2, '0')} · ${labels.get(stage.key) ?? stage.key} — ${
              STAGE_STATE_LABEL[state]
            }`}
            aria-hidden="true"
          >
            {GLYPH[state]}
          </span>
        );
      })}
      <span className={styles.stripNote}>
        {missed.length === 0 ? 'все этапы выполнены' : `не выполнено: ${missed.length}`}
      </span>
      {missed.length > 0 ? <span className={styles.srOnly}>— {missed.join('; ')}</span> : null}
    </span>
  );
}
