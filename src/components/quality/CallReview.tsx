'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, audioUrl, type CallQualityResponse } from '@/api/client';
import { useCall, useCallQuality } from '@/api/queries';
import { AUDIO_STATUS_NOTE, formatDateTime, formatDuration } from '@/lib/format';
import {
  qualityFailureMessage,
  type ScoreTone,
  STAGE_STATE_LABEL,
  type StageState,
  scoreTone,
  stageState,
} from '@/lib/quality';
import styles from './CallReview.module.css';

/** Скорости воспроизведения — те же, что в карточке разговора. */
const SPEEDS = [1, 1.5, 2] as const;

const SCORE: Record<ScoreTone, string | undefined> = {
  good: styles.scoreGood,
  fair: styles.scoreFair,
  poor: styles.scorePoor,
};

const MARK: Record<StageState, string> = { done: '✓', failed: '✗', skipped: '—' };

const MARK_TONE: Record<StageState, string | undefined> = {
  done: styles.done,
  failed: styles.failed,
  skipped: styles.skipped,
};

/** Пункт левой колонки: этап скрипта или возражение клиента. */
type Item = {
  id: string;
  num: string;
  label: string;
  state: StageState;
  /** Состояние словами — для подсказки и для тех, кто не видит знак. */
  verdict: string;
  mandatory: boolean;
  comment: string;
  /** Реплики, на которых основан вердикт. */
  seqs: number[];
};

function checklist(quality: CallQualityResponse | undefined): {
  stages: Item[];
  objections: Item[];
} {
  if (!quality?.script_applies) return { stages: [], objections: [] };
  const stages = (quality.stages ?? []).map((stage, index): Item => {
    const state = stageState(stage);
    return {
      id: `stage:${stage.key}`,
      num: String(index + 1).padStart(2, '0'),
      label: stage.label,
      state,
      verdict: STAGE_STATE_LABEL[state],
      mandatory: stage.mandatory,
      comment: stage.comment ?? '',
      seqs: stage.evidence ?? [],
    };
  });
  const objections = (quality.objections ?? []).map((item, index): Item => {
    // Реплика клиента с возражением и ответ оператора — по порядку и без повторов.
    const seqs = [
      ...new Set([
        ...(item.seq === null || item.seq === undefined ? [] : [item.seq]),
        ...(item.evidence ?? []),
      ]),
    ].sort((a, b) => a - b);
    return {
      id: `objection:${index}`,
      num: '',
      label: item.label,
      state: item.handled ? 'done' : 'failed',
      verdict: item.handled ? 'отработано' : 'не отработано',
      mandatory: false,
      comment: item.comment ?? '',
      seqs,
    };
  });
  return { stages, objections };
}

/** Сколько уезжает панель при закрытии. Совпадает с `--dur-2` в стилях. */
const CLOSE_MS = 180;

/** Движение включено: браузер умеет о нём спросить, и человек его не отключал. */
function animated(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function roleLabel(speaker: string): string {
  if (speaker === 'operator') return 'оператор';
  if (speaker === 'client') return 'клиент';
  return 'не определён';
}

/**
 * Разбор звонка: вердикты по этапам рядом с тем, что было сказано.
 *
 * Модель может ошибаться, и проверить её можно только разговором. Поэтому
 * этап ведёт к своим репликам, а метка времени включает запись с этого места.
 * Реплики, на которые ссылается невыполненный этап, отмечены в разговоре сразу —
 * плохое место видно, не выбирая этап.
 */
export function CallReview({
  callId,
  onClose,
  onPrev,
  onNext,
}: {
  callId: string;
  onClose: () => void;
  /** Соседние звонки списка; `undefined` — соседа нет. */
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    panelRef.current?.focus();
    // Страница под панелью не должна листаться колесом, пока листают разговор.
    // Вместе с прокруткой у неё исчезает полоса, и без поправки всё под панелью
    // прыгало бы вправо на её ширину: место полосы занимает отступ.
    const { body, documentElement } = document;
    const gap = window.innerWidth - documentElement.clientWidth;
    const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = previous.overflow;
      body.style.paddingRight = previous.paddingRight;
      clearTimeout(timer.current);
    };
  }, []);

  // Панель уезжает, и только потом исчезает: закрытие без движения после
  // въезда с движением читается как сбой.
  const close = useCallback(() => {
    if (timer.current !== undefined) return;
    if (!animated()) {
      onClose();
      return;
    }
    setClosing(true);
    timer.current = setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <>
      <button
        type="button"
        className={`${styles.backdrop} ${closing ? styles.backdropClosing : ''}`}
        aria-hidden="true"
        tabIndex={-1}
        onClick={close}
      />
      <aside
        className={`${styles.panel} ${closing ? styles.panelClosing : ''}`}
        aria-label="Разбор звонка"
        ref={panelRef}
        tabIndex={-1}
      >
        {/* Ключ по звонку: позиция записи и выбранный этап — свойства одного
            разбора. Сама панель при этом остаётся на месте — переход к
            соседнему звонку не должен заново её выдвигать. */}
        <Review key={callId} callId={callId} onClose={close} onPrev={onPrev} onNext={onNext} />
      </aside>
    </>
  );
}

function Review({
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
  const quality = useCallQuality(callId, true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const replyRefs = useRef(new Map<number, HTMLButtonElement>());
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
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

  const flagged = useMemo(() => {
    const seqs = new Set<number>();
    for (const item of [...stages, ...objections]) {
      if (item.state === 'failed') for (const seq of item.seqs) seqs.add(seq);
    }
    return seqs;
  }, [stages, objections]);

  const currentSeq = useMemo(() => {
    const ms = position * 1000;
    let found = -1;
    for (const segment of segments) {
      if (segment.start_ms <= ms) found = segment.seq;
      else break;
    }
    return found;
  }, [position, segments]);

  const seek = useCallback((seconds: number, play: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, seconds);
    setPosition(audio.currentTime);
    // Браузер вправе отказать в воспроизведении; перемотка при этом уже сделана.
    if (play) Promise.resolve(audio.play()).catch(() => undefined);
  }, []);

  function show(seq: number | undefined) {
    if (seq === undefined) return;
    replyRefs.current.get(seq)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }

  function pick(item: Item) {
    const next = picked === item.id ? null : item.id;
    setPicked(next);
    if (next) show(item.seqs.find((seq) => starts.has(seq)));
  }

  function listen(item: Item, seq: number) {
    setPicked(item.id);
    show(seq);
    seek((starts.get(seq) ?? 0) / 1000, true);
  }

  const evaluation = quality.isError ? undefined : quality.data;
  const failure =
    quality.error instanceof ApiError ? qualityFailureMessage(quality.error.detail) : undefined;
  const notEvaluated =
    !failure && quality.error instanceof ApiError && quality.error.kind === 'not_found';
  const score = evaluation?.script_applies ? (evaluation.score ?? null) : null;
  const violated = stages.some((item) => item.mandatory && item.state === 'failed');
  const rolesKnown = segments.some(
    (segment) => segment.speaker === 'operator' || segment.speaker === 'client',
  );

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
          <button type="button" className={styles.button} disabled={!onPrev} onClick={onPrev}>
            ← пред.
          </button>
          <button type="button" className={styles.button} disabled={!onNext} onClick={onNext}>
            след. →
          </button>
          <button
            type="button"
            className={styles.button}
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
            <div className={styles.player}>
              {/* biome-ignore lint/a11y/useMediaCaption: субтитры — это разговор справа */}
              <audio
                ref={audioRef}
                src={audioUrl(callId)}
                preload="metadata"
                onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
              />
              <button
                type="button"
                className={`${styles.button} ${styles.primary}`}
                aria-label={playing ? 'Пауза' : 'Слушать'}
                onClick={() => {
                  const audio = audioRef.current;
                  if (!audio) return;
                  if (audio.paused) Promise.resolve(audio.play()).catch(() => undefined);
                  else audio.pause();
                }}
              >
                {playing ? '❚❚' : '▶'}
              </button>
              <input
                type="range"
                className={styles.range}
                aria-label="Позиция в записи"
                min={0}
                max={Math.max(1, Math.floor(duration))}
                step={1}
                value={Math.min(Math.floor(position), Math.max(1, Math.floor(duration)))}
                onChange={(event) => seek(Number(event.target.value), false)}
              />
              <span className={styles.time}>
                {formatDuration(position)} / {formatDuration(duration)}
              </span>
              {SPEEDS.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`${styles.button} ${speed === value ? styles.active : ''}`}
                  aria-pressed={speed === value}
                  onClick={() => {
                    setSpeed(value);
                    if (audioRef.current) audioRef.current.playbackRate = value;
                  }}
                >
                  {value}×
                </button>
              ))}
            </div>
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
              <section className={styles.column} aria-label="Этапы скрипта">
                <h3 className={styles.columnTitle}>Этапы скрипта</h3>
                <Items
                  items={stages}
                  picked={picked}
                  starts={starts}
                  onPick={pick}
                  onListen={listen}
                />
                {objections.length > 0 ? (
                  <>
                    <h3 className={styles.columnTitle}>Возражения клиента</h3>
                    <Items
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

            <section className={styles.column} aria-label="Разговор">
              <h3 className={styles.columnTitle}>Разговор</h3>
              {segments.length > 0 && !rolesKnown ? (
                <p className={styles.comment}>Роли оператора и клиента пока не определены.</p>
              ) : null}
              <div className={styles.replies}>
                {segments.map((segment) => (
                  <button
                    type="button"
                    key={segment.seq}
                    ref={(node) => {
                      if (node) replyRefs.current.set(segment.seq, node);
                      else replyRefs.current.delete(segment.seq);
                    }}
                    className={[
                      styles.reply,
                      segment.seq === currentSeq && playing ? styles.replyPlaying : '',
                      pickedSeqs.has(segment.seq) ? styles.replyPicked : '',
                      flagged.has(segment.seq) ? styles.replyFlagged : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-current={pickedSeqs.has(segment.seq) ? 'true' : undefined}
                    onClick={() => seek(segment.start_ms / 1000, true)}
                  >
                    <span className={styles.replyTime}>
                      {formatDuration(segment.start_ms / 1000)}
                    </span>
                    <span
                      className={[
                        styles.role,
                        segment.speaker === 'operator' ? styles.roleOperator : '',
                        segment.speaker === 'client' ? styles.roleClient : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {roleLabel(segment.speaker)}
                    </span>
                    <span className={styles.text}>{segment.text}</span>
                  </button>
                ))}
              </div>
            </section>
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

function Items({
  items,
  picked,
  starts,
  onPick,
  onListen,
}: {
  items: readonly Item[];
  picked: string | null;
  starts: ReadonlyMap<number, number>;
  onPick: (item: Item) => void;
  onListen: (item: Item, seq: number) => void;
}) {
  return (
    <ul className={styles.items}>
      {items.map((item) => {
        const seqs = item.seqs.filter((seq) => starts.has(seq));
        return (
          <li
            key={item.id}
            className={`${styles.item} ${picked === item.id ? styles.itemPicked : ''}`}
          >
            <button
              type="button"
              className={styles.itemHead}
              aria-pressed={picked === item.id}
              onClick={() => onPick(item)}
            >
              <span
                className={`${styles.mark} ${MARK_TONE[item.state]}`}
                title={item.verdict}
                aria-hidden="true"
              >
                {MARK[item.state]}
              </span>
              <span className={styles.num}>{item.num}</span>
              <span>
                {item.label}
                <span className={styles.srOnly}> — {item.verdict}</span>
                {item.mandatory ? <span className={styles.tag}>обязательный</span> : null}
              </span>
            </button>
            {item.comment || seqs.length > 0 ? (
              <div className={styles.itemBody}>
                {item.comment ? <p className={styles.comment}>{item.comment}</p> : null}
                {seqs.length > 0 ? (
                  <div className={styles.times}>
                    {seqs.map((seq) => (
                      <button
                        type="button"
                        key={seq}
                        className={styles.timeChip}
                        title="слушать с этой реплики"
                        onClick={() => onListen(item, seq)}
                      >
                        {formatDuration((starts.get(seq) ?? 0) / 1000)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
