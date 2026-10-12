'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import {
  AUDIO_STATUS_NOTE,
  activeSeq,
  type SegmentModel,
  useCall,
  useRecordingPlayer,
} from '@/entities/call';
import {
  qualityFailureMessage,
  type ScoreTone,
  scoreTone,
  useCallQuality,
} from '@/entities/evaluation';
import { ApiError } from '@/shared/api';
import { formatDateTime, formatDuration } from '@/shared/lib/format';
import { type ChecklistItem, checklist, flaggedSeqs } from '../model/checklist';
import styles from './CallReviewBody.module.css';
import { ChecklistItems } from './ChecklistItems';
import { ReviewPlayer } from './ReviewPlayer';
import { ReviewTranscript } from './ReviewTranscript';
import review from './review.module.css';

const SCORE: Record<ScoreTone, string | undefined> = {
  good: styles.scoreGood,
  fair: styles.scoreFair,
  poor: styles.scorePoor,
};

/**
 * Содержимое разбора одного звонка: балл, запись, чек-лист и разговор.
 *
 * Состояние здесь — свойство одного разбора: позиция записи и выбранный пункт.
 * Родитель ставит звонок в `key`, и при переходе к соседнему звонку оно
 * начинается заново, а сама панель остаётся на месте.
 *
 * @param props Свойства компонента.
 * @param props.callId Идентификатор звонка.
 * @param props.onClose Вызывается, когда разбор закрывают.
 * @param props.onPrev Открывает предыдущий звонок списка; `undefined` — его нет.
 * @param props.onNext Открывает следующий звонок списка; `undefined` — его нет.
 * @returns Шапка разбора и его тело либо состояние загрузки и отказа.
 */
export function CallReviewBody({
  callId,
  onClose,
  onPrev,
  onNext,
}: {
  callId: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const card = useCall(callId);
  const quality = useCallQuality(callId);
  const player = useRecordingPlayer();
  const { seek } = player;
  const replyRefs = useRef(new Map<number, HTMLButtonElement>());
  const [picked, setPicked] = useState<string | null>(null);

  const data = card.data;
  const segments = useMemo(() => data?.segments ?? [], [data]);
  const duration = data?.duration_s ?? 0;
  const hasAudio = data?.audio_status === 'stored';
  const { stages, objections } = useMemo(
    () => checklist(quality.isError ? undefined : quality.data),
    [quality.data, quality.isError],
  );
  const starts = useMemo(
    () => new Map(segments.map((segment) => [segment.seq, segment.start_ms])),
    [segments],
  );

  const pickedSeqs = useMemo(() => {
    const item = [...stages, ...objections].find((entry) => entry.id === picked);
    return new Set(item?.seqs ?? []);
  }, [stages, objections, picked]);

  const flagged = useMemo(() => flaggedSeqs([...stages, ...objections]), [stages, objections]);

  const currentSeq = useMemo(
    () => activeSeq(segments, player.position),
    [player.position, segments],
  );

  /**
   * Прокручивает разговор к реплике.
   *
   * @param seq Номер реплики; `undefined` — прокручивать некуда.
   */
  function show(seq: number | undefined) {
    if (seq === undefined) return;
    replyRefs.current.get(seq)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }

  /**
   * Выбирает пункт чек-листа и показывает его первую реплику; повторный клик снимает выбор.
   *
   * @param item Пункт, по которому кликнули.
   */
  function pick(item: ChecklistItem) {
    const next = picked === item.id ? null : item.id;
    setPicked(next);
    if (next) show(item.seqs.find((seq) => starts.has(seq)));
  }

  /**
   * Включает запись с реплики, на которую ссылается пункт чек-листа.
   *
   * @param item Пункт, чью метку времени нажали.
   * @param seq Номер реплики этой метки.
   */
  function listen(item: ChecklistItem, seq: number) {
    setPicked(item.id);
    show(seq);
    seek((starts.get(seq) ?? 0) / 1000, true);
  }

  /**
   * Включает запись с начала реплики, по которой кликнули в разговоре.
   *
   * @param segment Реплика разговора.
   */
  function listenReply(segment: SegmentModel) {
    seek(segment.start_ms / 1000, true);
  }

  const evaluation = quality.isError ? undefined : quality.data;
  const failure =
    quality.error instanceof ApiError ? qualityFailureMessage(quality.error.detail) : undefined;
  const notEvaluated =
    !failure && quality.error instanceof ApiError && quality.error.kind === 'not_found';
  const score = evaluation?.script_applies ? (evaluation.score ?? null) : null;
  const violated = stages.some((item) => item.mandatory && item.state === 'failed');

  return (
    <>
      <header className={styles.head}>
        {score === null ? (
          <span className={`${styles.score} ${styles.scoreNone}`}>нет балла</span>
        ) : (
          <span className={`${styles.score} ${SCORE[scoreTone(score)]}`}>{score}%</span>
        )}
        <div className={styles.heading}>
          <h2 className={styles.title}>Разбор звонка</h2>
          {data ? (
            <div className={styles.meta}>
              <span>{data.operator_login || 'оператор не указан'}</span>
              <span>{formatDateTime(data.started_at)}</span>
              <span>{formatDuration(data.duration_s)}</span>
              {evaluation?.script_applies ? (
                <span>
                  этапов {evaluation.passed_count}/{evaluation.stage_count}
                </span>
              ) : null}
              {evaluation?.outcome_label ? <span>итог: {evaluation.outcome_label}</span> : null}
              {violated ? (
                <span className={styles.violation}>нарушено обязательное условие</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className={styles.actions}>
          <button type="button" className={review.button} disabled={!onPrev} onClick={onPrev}>
            ← пред.
          </button>
          <button type="button" className={review.button} disabled={!onNext} onClick={onNext}>
            след. →
          </button>
          <button
            type="button"
            className={review.button}
            onClick={onClose}
            aria-label="Закрыть разбор"
          >
            ✕
          </button>
        </div>
      </header>

      {card.isPending ? (
        <p className={styles.note}>Загружаем звонок…</p>
      ) : card.isError || !data ? (
        <p className={`${styles.note} ${styles.error}`} role="alert">
          {card.error instanceof ApiError && card.error.kind === 'not_found'
            ? 'Звонок не найден.'
            : 'Не удалось загрузить звонок.'}
        </p>
      ) : (
        <>
          {hasAudio ? (
            <ReviewPlayer callId={callId} player={player} duration={duration} />
          ) : (
            <p className={styles.note}>
              {AUDIO_STATUS_NOTE[data.audio_status] ?? 'Запись недоступна — разговор ниже.'}
            </p>
          )}

          {quality.isPending ? (
            <p className={styles.note}>Загружаем оценку…</p>
          ) : quality.isError ? (
            <p
              className={`${styles.note} ${notEvaluated ? '' : styles.error}`}
              role={notEvaluated ? undefined : 'alert'}
            >
              {failure ?? (notEvaluated ? 'Звонок ещё не оценён.' : 'Не удалось загрузить оценку.')}
            </p>
          ) : evaluation && !evaluation.script_applies ? (
            <p className={styles.note}>
              Скрипт к звонку не применим{evaluation.summary ? `: ${evaluation.summary}` : '.'}
            </p>
          ) : evaluation?.summary ? (
            <p className={styles.note}>{evaluation.summary}</p>
          ) : null}

          <div className={styles.body}>
            {stages.length > 0 ? (
              <section className={review.column} aria-label="Этапы скрипта">
                <h3 className={review.columnTitle}>Этапы скрипта</h3>
                <ChecklistItems
                  items={stages}
                  picked={picked}
                  starts={starts}
                  onPick={pick}
                  onListen={listen}
                />
                {objections.length > 0 ? (
                  <>
                    <h3 className={review.columnTitle}>Возражения клиента</h3>
                    <ChecklistItems
                      items={objections}
                      picked={picked}
                      starts={starts}
                      onPick={pick}
                      onListen={listen}
                    />
                  </>
                ) : null}
              </section>
            ) : null}

            <ReviewTranscript
              segments={segments}
              // Звучащая реплика отмечена, только пока запись идёт: на паузе
              // отметка читалась бы как «выбрано», а выбор — это пункт чек-листа.
              playingSeq={player.playing ? currentSeq : -1}
              pickedSeqs={pickedSeqs}
              flaggedSeqs={flagged}
              replyRefs={replyRefs}
              onListen={listenReply}
            />
          </div>

          <footer className={styles.foot}>
            {evaluation ? (
              <span>
                Оценку поставила модель {evaluation.model_name} по скрипту{' '}
                {evaluation.script_version}
              </span>
            ) : null}
            <span title={data.session_id}>{data.session_id}</span>
            <span className={styles.spacer} />
            <Link href={`/calls/${callId}`} className={styles.linkButton}>
              Открыть в диалогах →
            </Link>
          </footer>
        </>
      )}
    </>
  );
}
