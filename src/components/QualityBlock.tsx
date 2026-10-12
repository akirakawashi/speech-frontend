'use client';

import { ApiError, type SegmentModel } from '@/api/client';
import { useCallQuality } from '@/api/queries';
import { formatDuration } from '@/lib/format';
import { qualityFailureMessage, type ScoreTone, scoreTone } from '@/lib/quality';
import styles from './QualityBlock.module.css';

const TONE: Record<ScoreTone, string | undefined> = {
  good: styles.good,
  fair: styles.fair,
  poor: styles.poor,
};

/**
 * Оценка звонка по скрипту в карточке разговора.
 *
 * Каждый вердикт ведёт к репликам, на которых он основан: по метке времени
 * запись перематывается туда же, куда ведёт клик по реплике транскрипта.
 * Контролёр проверяет модель ушами, а не верит ей на слово.
 */
export function QualityBlock({
  callId,
  segments,
  onSeek,
}: {
  callId: string;
  segments: readonly SegmentModel[];
  onSeek: (seconds: number) => void;
}) {
  const quality = useCallQuality(callId, true);

  if (quality.isPending) return null;
  if (quality.isError) {
    // Звонок другого источника по скрипту не оценивается и оценён не будет:
    // блока нет вовсе, иначе карточка обещала бы оценку, которой не случится.
    if (quality.error instanceof ApiError && quality.error.detail === 'not_applicable') return null;
    // `404` — звонок ещё не оценён: это состояние, и о нём говорится спокойно.
    const failure =
      quality.error instanceof ApiError ? qualityFailureMessage(quality.error.detail) : undefined;
    const notEvaluated =
      !failure && quality.error instanceof ApiError && quality.error.kind === 'not_found';
    return (
      <section className={styles.block} aria-label="Оценка по скрипту">
        <h3 className={styles.title}>Оценка по скрипту</h3>
        <p className={styles.note} role={notEvaluated ? undefined : 'alert'}>
          {failure ?? (notEvaluated ? 'Звонок ещё не оценён.' : 'Не удалось загрузить оценку.')}
        </p>
      </section>
    );
  }

  const data = quality.data;
  if (!data.script_applies) {
    return (
      <section className={styles.block} aria-label="Оценка по скрипту">
        <h3 className={styles.title}>Оценка по скрипту</h3>
        <p className={styles.note}>
          Скрипт к звонку не применим{data.summary ? `: ${data.summary}` : '.'}
        </p>
      </section>
    );
  }

  const starts = new Map(segments.map((segment) => [segment.seq, segment.start_ms]));

  const score = data.score ?? 0;
  return (
    <section className={styles.block} aria-label="Оценка по скрипту">
      <div className={styles.head}>
        <h3 className={styles.title}>Оценка по скрипту</h3>
        <span className={`${styles.score} ${TONE[scoreTone(score)]}`}>{score}%</span>
        <span className={styles.muted}>
          этапов {data.passed_count}/{data.stage_count}
          {data.outcome_label ? ` · ${data.outcome_label}` : ''}
        </span>
      </div>
      {data.summary ? <p className={styles.summary}>{data.summary}</p> : null}

      <ol className={styles.list}>
        {(data.stages ?? []).map((stage) => {
          const state = !stage.applicable ? 'skipped' : stage.passed ? 'passed' : 'failed';
          return (
            <li key={stage.key} className={styles.item}>
              <span
                className={`${styles.mark} ${styles[state]}`}
                title={
                  state === 'skipped'
                    ? 'не понадобился — засчитан'
                    : state === 'passed'
                      ? 'засчитан'
                      : 'не засчитан'
                }
              >
                {state === 'skipped' ? '—' : state === 'passed' ? '✓' : '✗'}
              </span>
              <span className={styles.label}>
                {stage.label}
                {stage.mandatory ? <span className={styles.tag}>чек-лист</span> : null}
              </span>
              {stage.comment ? <span className={styles.comment}>{stage.comment}</span> : null}
              <Evidence seqs={stage.evidence ?? []} starts={starts} onSeek={onSeek} />
            </li>
          );
        })}
      </ol>

      {data.objections?.length ? (
        <>
          <h4 className={styles.subtitle}>Возражения клиента</h4>
          <ul className={styles.list}>
            {data.objections.map((item, index) => (
              <li key={`${item.type}-${item.seq ?? index}`} className={styles.item}>
                <span
                  className={`${styles.mark} ${item.handled ? styles.passed : styles.failed}`}
                  title={item.handled ? 'отработано' : 'не отработано'}
                >
                  {item.handled ? '✓' : '✗'}
                </span>
                <span className={styles.label}>{item.label}</span>
                {item.comment ? <span className={styles.comment}>{item.comment}</span> : null}
                <Evidence
                  seqs={objectionSeqs(item.seq, item.evidence)}
                  starts={starts}
                  onSeek={onSeek}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className={styles.note}>
        Оценку поставила модель {data.model_name} по скрипту {data.script_version}.
      </p>
    </section>
  );
}

/** Метки времени реплик-доказательств; реплики, которых нет в карточке, пропускаются. */
function Evidence({
  seqs,
  starts,
  onSeek,
}: {
  seqs: readonly number[];
  starts: ReadonlyMap<number, number>;
  onSeek: (seconds: number) => void;
}) {
  const found = seqs.filter((seq) => starts.has(seq));
  if (found.length === 0) return null;
  return (
    <span className={styles.evidence}>
      {found.map((seq) => {
        const start = starts.get(seq) ?? 0;
        return (
          <button
            type="button"
            key={seq}
            className={styles.chip}
            title="перемотать к реплике"
            onClick={() => onSeek(start / 1000)}
          >
            {formatDuration(start / 1000)}
          </button>
        );
      })}
    </span>
  );
}

/** Реплика клиента с возражением и ответ оператора — по порядку и без повторов. */
function objectionSeqs(seq: number | null | undefined, evidence: number[] | undefined): number[] {
  const all = [...(seq === null || seq === undefined ? [] : [seq]), ...(evidence ?? [])];
  return [...new Set(all)].sort((a, b) => a - b);
}
