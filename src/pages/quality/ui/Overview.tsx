'use client';

import { formatDay } from '@/shared/lib/date';
import { percent } from '@/shared/lib/format';
import { kit } from '@/shared/ui/analytics-kit';
import type { QualitySummaryResponse } from '../api/types';
import {
  BUCKET_LABEL,
  BUCKET_RANGE,
  BUCKETS,
  type Bucket,
  clearListFilter,
  hasListFilter,
  type QualityState,
} from '../model/state';
import styles from './Overview.module.css';
import { ReviewFile } from './ReviewFile';

const TILE: Record<Bucket, string | undefined> = {
  poor: styles.tilePoor,
  fair: styles.tileFair,
  good: styles.tileGood,
};

const PART: Record<Bucket, string | undefined> = {
  poor: styles.partPoor,
  fair: styles.partFair,
  good: styles.partGood,
};

/**
 * Блок «Картина периода»: сколько звонков плохих, средних и хороших.
 *
 * В макете заказчика этого блока нет — он наш и стоит под блоками макета, над списком звонков,
 * который им фильтруется.
 *
 * Разряды, а не средний балл: среднее из одного нулевого звонка и двух
 * отличных выглядит «нормально» и прячет ровно тот звонок, ради которого экран
 * открывают. Плитка — заодно фильтр списка.
 *
 * @param props Свойства компонента.
 * @param props.summary Сводка оценок за период.
 * @param props.state Состояние экрана.
 * @param props.onChange Вызывается с новым состоянием экрана.
 * @returns Карточка с плитками разрядов, показателями и кнопкой выгрузки.
 */
export function Overview({
  summary,
  state,
  onChange,
}: {
  summary: QualitySummaryResponse;
  state: QualityState;
  onChange: (next: QualityState) => void;
}) {
  const calls = summary.calls;
  const skipped = summary.evaluated - calls;

  return (
    <section className={kit.card} aria-label="Картина периода">
      <div className={kit.cardHead}>
        <h2 className={kit.cardTitle}>Картина периода</h2>
        <div className={styles.headTools}>
          <span className={kit.hint}>
            {formatDay(state.from)} — {formatDay(state.to)}
          </span>
          {/* Охват в `key`: отказ выгрузки не переезжает в другой период. */}
          <ReviewFile
            key={`${state.from}|${state.to}|${state.operator}`}
            state={state}
            available={calls > 0}
          />
        </div>
      </div>

      <div className={styles.kpis}>
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={!hasListFilter(state)}
          onClick={() => onChange(clearListFilter(state))}
        >
          Все записи: <b>{summary.total ?? summary.evaluated}</b>
        </button>
        <span className={styles.kpi}>
          Оценены по скрипту: <b>{calls}</b>
        </span>
        {/* Записи, у которых расшифровки уже не будет. Отдельно от «ожидают»:
            оценка им не появится, и обещать её незачем. */}
        {summary.unavailable ? (
          <span className={styles.kpi}>
            Без расшифровки: <b>{summary.unavailable}</b>
          </span>
        ) : null}
      </div>

      {calls > 0 ? (
        <div className={styles.spread} aria-hidden="true">
          {BUCKETS.map((bucket) =>
            summary.buckets[bucket] > 0 ? (
              <div
                key={bucket}
                className={`${styles.spreadPart} ${PART[bucket]}`}
                style={{ flexGrow: summary.buckets[bucket] }}
              />
            ) : null,
          )}
        </div>
      ) : null}

      <div className={styles.tiles}>
        {BUCKETS.map((bucket) => {
          const count = summary.buckets[bucket];
          return (
            <button
              type="button"
              key={bucket}
              className={`${styles.tile} ${TILE[bucket]}`}
              aria-pressed={state.bucket === bucket}
              onClick={() =>
                onChange({
                  ...state,
                  bucket: state.bucket === bucket ? '' : bucket,
                  skipped: false,
                  evaluationStatus: '',
                })
              }
            >
              <span className={styles.tileValue}>{count}</span>
              <span className={styles.tileLabel}>{BUCKET_LABEL[bucket]}</span>
              <span className={styles.tileHint}>
                {BUCKET_RANGE[bucket]}
                {calls > 0 ? ` · ${percent(count / calls)} звонков` : ''}
              </span>
            </button>
          );
        })}
        {/* Звонки без балла. Отдельная плитка, а не строчка мелким шрифтом:
            «оценено 4 из 12» без причины читается как сбой оценки. */}
        <button
          type="button"
          className={styles.tile}
          aria-pressed={state.skipped}
          onClick={() => onChange({ ...clearListFilter(state), skipped: !state.skipped })}
        >
          <span className={styles.tileValue}>{skipped}</span>
          <span className={styles.tileLabel}>Не по скрипту</span>
          <span className={styles.tileHint}>без балла — с причиной</span>
        </button>
        {(['failed', 'pending'] as const).map((status) => (
          <button
            type="button"
            key={status}
            className={styles.tile}
            aria-pressed={state.evaluationStatus === status}
            onClick={() =>
              onChange({
                ...clearListFilter(state),
                evaluationStatus: state.evaluationStatus === status ? '' : status,
              })
            }
          >
            <span className={styles.tileValue}>{summary[status] ?? 0}</span>
            <span className={styles.tileLabel}>
              {status === 'failed' ? 'Не удалось оценить' : 'Ожидают оценки'}
            </span>
            <span className={styles.tileHint}>
              {status === 'failed' ? 'без балла — открыть причину' : 'без балла'}
            </span>
          </button>
        ))}
      </div>

      <div className={styles.kpis}>
        <span className={styles.kpi}>
          Средний балл{' '}
          <b>
            {summary.average_score === null || summary.average_score === undefined
              ? '—'
              : `${Math.round(summary.average_score)}%`}
          </b>
        </span>
        <span className={styles.kpi}>
          Полностью по скрипту <b>{calls > 0 ? `${summary.fully_correct} из ${calls}` : '—'}</b>
        </span>
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={state.violations}
          onClick={() =>
            onChange({
              ...state,
              violations: !state.violations,
              skipped: false,
              evaluationStatus: '',
            })
          }
        >
          Нарушения обязательных условий: <b>{summary.violations}</b>
        </button>
      </div>
    </section>
  );
}
