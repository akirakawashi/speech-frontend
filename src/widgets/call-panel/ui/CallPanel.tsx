'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AUDIO_STATUS_NOTE,
  activeSeq,
  audioUrl,
  DEFAULT_SOURCE,
  type SegmentModel,
  useCall,
  useRecordingPlayer,
} from '@/entities/call';
import { PERM_DOWNLOAD_AUDIO, PERM_QUALITY, useSession } from '@/entities/session';
import { ApiError } from '@/shared/api';
import { CallMeta } from './CallMeta';
import styles from './CallPanel.module.css';
import { CallReason } from './CallReason';
import { Classification } from './Classification';
import common from './common.module.css';
import { PanelPlayer } from './PanelPlayer';
import { QualityBlock } from './QualityBlock';
import { Transcript } from './Transcript';

/** Сколько миллисекунд кнопка «Ссылка» показывает «Скопировано». */
const COPIED_MS = 2000;

export type CallPanelProps = {
  callId: string;
  query: string;
  /** Позиция из адреса, в секундах: `?t=` (PLY-06). */
  startAt: number;
  onClose: () => void;
  /**
   * Только запись и текст: без пересказа, причины, классификации и оценки.
   * Для поиска на экране оценки — там панель стоит в блоке закреплённой
   * высоты, и всё это оттесняло плеер и найденные реплики за край.
   */
  compact?: boolean;
};

/**
 * Панель разговора: реквизиты, запись с перемоткой и транскрипт.
 *
 * Встаёт рядом с выдачей поиска — на «Диалогах» и на экране оценки качества.
 * С поисковым запросом отмечает реплики с совпадениями и ходит по ним.
 *
 * @param props Свойства компонента.
 * @param props.callId Идентификатор звонка.
 * @param props.query Поисковый запрос, совпадения с которым отмечаются в записи и тексте.
 * @param props.startAt Секунда, с которой открыть запись.
 * @param props.onClose Вызывается, когда панель закрывают.
 * @param props.compact Показывать только запись и текст.
 * @returns Панель разговора или её состояние загрузки и отказа.
 */
export function CallPanel({ callId, query, startAt, onClose, compact = false }: CallPanelProps) {
  const session = useSession();
  const player = useRecordingPlayer();
  const { audioRef, position, seek } = player;
  const [hitIndex, setHitIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const card = useCall(callId, query);

  const data = card.data;
  const segments = useMemo(() => data?.segments ?? [], [data]);
  const hits = useMemo(() => data?.hit_seqs ?? [], [data]);
  const duration = data?.duration_s ?? 0;
  const hasAudio = data?.audio_status === 'stored';

  // Позиция из адреса применяется один раз, когда метаданные уже загружены:
  // до этого `currentTime` присвоить нельзя — браузер молча его отбросит.
  const appliedStart = useRef(false);
  useEffect(() => {
    if (appliedStart.current || !hasAudio || startAt <= 0) return;
    appliedStart.current = true;
    seek(startAt);
  }, [hasAudio, startAt, seek]);

  const playingSeq = useMemo(() => activeSeq(segments, position), [position, segments]);

  /**
   * Переходит к совпадению по его порядковому номеру.
   *
   * По кругу (PLY-03): «след.» на последнем совпадении возвращает к первому,
   * иначе кнопка просто перестаёт работать и выглядит сломанной.
   *
   * @param next Порядковый номер совпадения; может выйти за границы списка.
   */
  function goToHit(next: number) {
    if (hits.length === 0) return;
    const index = ((next % hits.length) + hits.length) % hits.length;
    setHitIndex(index);
    const seq = hits[index];
    const target = segments.find((segment) => segment.seq === seq);
    if (target) seek(target.start_ms / 1000);
  }

  /**
   * Перематывает запись на реплику, по которой кликнули.
   *
   * @param segment Реплика транскрипта.
   */
  function pickReply(segment: SegmentModel) {
    seek(segment.start_ms / 1000);
    const index = hits.indexOf(segment.seq);
    if (index >= 0) setHitIndex(index);
  }

  /** Копирует ссылку на разговор с источником, запросом и текущей позицией записи. */
  async function copyLink() {
    const params = new URLSearchParams();
    // Вкладка — по источнику самого звонка, а не по той, что открыта сейчас
    // (S-35): без неё получатель ссылки на звонок Телфина видел бы рядом с ним
    // список NCC. Умолчание, как и везде в адресе, не пишется.
    if (data?.source && data.source !== DEFAULT_SOURCE) params.set('source', data.source);
    if (query.trim()) params.set('q', query.trim());
    // Позиция берётся у самого плеера, а не из состояния: состояние обновляет
    // событие `timeupdate`, и между перемоткой и перерисовкой есть зазор — в
    // него попадает ссылка с прошлой позицией, что заметно именно тогда, когда
    // человек перемотал и сразу копирует.
    const at = audioRef.current?.currentTime ?? position;
    if (at > 0) params.set('t', String(Math.floor(at)));
    const link = `${window.location.origin}/calls/${callId}${
      params.toString() ? `?${params}` : ''
    }`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Буфер обмена недоступен без защищённого соединения — тогда адрес
      // просто показывается, чтобы его можно было скопировать руками.
      window.prompt('Ссылка на разговор', link);
    }
  }

  if (card.isPending) {
    return (
      <aside className={styles.panel} aria-label="Разговор">
        <p className={styles.note}>Загружаем разговор…</p>
      </aside>
    );
  }

  if (card.isError || !data) {
    const error = card.error;
    const message =
      error instanceof ApiError && error.kind === 'not_found'
        ? 'Разговор не найден.'
        : 'Не удалось загрузить разговор.';
    return (
      <aside className={styles.panel} aria-label="Разговор">
        <div className={`${styles.note} ${styles.error}`} role="alert">
          {message}
        </div>
        <button type="button" className={common.button} onClick={onClose}>
          Закрыть
        </button>
      </aside>
    );
  }

  const note = AUDIO_STATUS_NOTE[data.audio_status];

  return (
    <aside className={styles.panel} aria-label="Разговор">
      <header className={styles.head}>
        <h2 className={styles.title}>Разговор</h2>
        {/* Идентификатор сессии длинный и в шапке занимал всю строку, оттесняя
            всё остальное. Он нужен для сверки с источником — NCC или Телфином,
            поэтому остаётся — но обрезается, а целиком показывается по
            наведению. */}
        <span className={styles.session} title={data.session_id}>
          {data.session_id}
        </span>
        <span className={common.spacer} />
        {/* «Ссылка» и «Скачать» — в шапке, а не в строке плеера: они относятся
            к разговору целиком, а не к воспроизведению. */}
        <button type="button" className={styles.link} onClick={copyLink}>
          {copied ? 'Скопировано' : 'Ссылка'}
        </button>
        {hasAudio && session.can(PERM_DOWNLOAD_AUDIO) ? (
          <a className={styles.link} href={audioUrl(callId, true)} download>
            Скачать
          </a>
        ) : null}
        <button type="button" className={common.button} onClick={onClose} aria-label="Закрыть">
          ✕
        </button>
      </header>

      <CallMeta data={data} />

      {compact ? null : (
        <>
          {data.summary ? <p className={styles.summary}>{data.summary}</p> : null}
          <CallReason data={data} />
          <Classification data={data} />
          {/* Оценка по скрипту — только тем, у кого право `quality`: это суждение о
              сотруднике, а не о разговоре, и поиск права на него не даёт. */}
          {session.can(PERM_QUALITY) ? (
            <QualityBlock callId={callId} segments={segments} onSeek={seek} />
          ) : null}
        </>
      )}

      {/* PLY-07: без записи плеер заменяется пометкой, транскрипт работает. */}
      {hasAudio ? (
        <PanelPlayer
          callId={callId}
          player={player}
          duration={duration}
          segments={segments}
          hits={hits}
          hitIndex={hitIndex}
        />
      ) : (
        <div className={styles.note}>{note ?? 'Запись недоступна — транскрипт доступен'}</div>
      )}

      <div className={common.actions}>
        {hits.length > 0 ? (
          <>
            <button type="button" className={common.button} onClick={() => goToHit(hitIndex - 1)}>
              ← пред.
            </button>
            <span className={styles.counter}>
              совпадение {hitIndex + 1} из {hits.length}
            </span>
            <button type="button" className={common.button} onClick={() => goToHit(hitIndex + 1)}>
              след. →
            </button>
          </>
        ) : null}
      </div>

      <Transcript
        segments={segments}
        playingSeq={playingSeq}
        hitSeq={hits[hitIndex]}
        onPick={pickReply}
      />
    </aside>
  );
}
