'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, audioUrl, type CallResponse, type RevealResponse, request } from '@/api/client';
import { CLASSIFIER_DEPTH, EMPTY_LEVEL_LABEL, pathCaption } from '@/lib/classifier';
import {
  AUDIO_STATUS_NOTE,
  formatDateTime,
  formatDuration,
  PRODUCT_LABEL,
  SEGMENT_LABEL,
  SENTIMENT_LABEL,
  SOURCE_LABEL,
} from '@/lib/format';
import { splitHighlight, stripHighlight } from '@/lib/highlight';
import { DEFAULT_SOURCE } from '@/lib/search-params';
import { PERM_DOWNLOAD_AUDIO, PERM_QUALITY, PERM_REVEAL_PII, useSession } from '@/lib/session';
import styles from './CallPanel.module.css';
import { QualityBlock } from './QualityBlock';

/** Скорости воспроизведения (PLY-02). Больше двух — уже неразборчиво. */
const SPEEDS = [1, 1.5, 2] as const;

/** Маска, которую ставит обезличивание. Совпадает с `MASK` на сервере. */
const MASK = '•••';

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

const LEVELS = Array.from({ length: CLASSIFIER_DEPTH }, (_, index) => index + 1);

/** Уровень пути на своём месте: уровня нет — прочерк, пустой уровень — словами. */
function levelText(path: readonly string[], level: number): string {
  if (level > path.length) return '—';
  return path[level - 1] || EMPTY_LEVEL_LABEL;
}

/**
 * Классификация звонка (SP-310): путь ИИ и путь оператора по одному дереву,
 * уровень против уровня. Совпадение — правило владельца: пустой уровень
 * оператора или прочерк не совпадает, итог — совпавших уровней из пяти.
 *
 * Ниже — тема по предложению ИИ помощника (SP-309): мнение модели сверх
 * разметки, и своя формулировка помечена как новая.
 */
function Classification({ data }: { data: CallResponse }) {
  const ai = data.ai_path ?? [];
  const operator = data.operator_path ?? [];
  const marks = data.level_match ?? [];
  const suggestion = data.ai_suggestion ?? [];
  if (ai.length === 0 && operator.length === 0 && suggestion.length === 0) return null;
  const matched = marks.filter(Boolean).length;
  return (
    <section className={styles.classification} aria-label="Классификация">
      <table className={styles.levels}>
        <thead>
          <tr>
            <th scope="col">Уровень</th>
            <th scope="col">ИИ</th>
            <th scope="col">Оператор</th>
            <th scope="col">Совпало</th>
          </tr>
        </thead>
        <tbody>
          {LEVELS.map((level) => (
            <tr key={level}>
              <td className={styles.levelNumber}>{level}</td>
              <td>{levelText(ai, level)}</td>
              <td>{levelText(operator, level)}</td>
              <td className={styles.levelMark}>
                {marks.length === 0 ? '—' : marks[level - 1] ? 'да' : 'нет'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.match}>
        {marks.length > 0
          ? `Совпадение с оператором: ${matched} из ${CLASSIFIER_DEPTH} уровней (${
              (matched / CLASSIFIER_DEPTH) * 100
            }%).`
          : operator.length === 0
            ? 'Сравнить не с чем: оператор звонок не классифицировал.'
            : 'Сравнить не с чем: классификации ИИ нет.'}
      </p>
      {suggestion.length > 0 ? (
        <p className={styles.aiTopic}>
          <span className={styles.aiTopicLabel}>Тема по предложению ИИ помощника:</span>{' '}
          {pathCaption(suggestion)}
          {data.ai_suggestion_is_new ? <span className={styles.aiTopicNew}>новая</span> : null}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Причина обращения (S-32): зачем звонил клиент — оценка модели по обезличенной
 * расшифровке, а не запись оператора. Код — из справочника контакт-центра.
 */
function CallReason({ data }: { data: CallResponse }) {
  if (!data.call_reason && !data.call_reason_code) return null;
  return (
    <p className={styles.aiTopic}>
      <span className={styles.aiTopicLabel}>Причина обращения:</span> {data.call_reason ?? ''}
      {data.call_reason_code ? (
        <span className={styles.aiTopicNew}>
          {data.call_reason_label
            ? `${data.call_reason_code} · ${data.call_reason_label}`
            : data.call_reason_code}
        </span>
      ) : null}
    </p>
  );
}

export function CallPanel({ callId, query, startAt, onClose, compact = false }: CallPanelProps) {
  const session = useSession();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [hitIndex, setHitIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const card = useQuery({
    queryKey: ['call', callId, query],
    queryFn: () =>
      request<CallResponse>(`/api/v1/calls/${callId}`, { query: { q: query || undefined } }),
  });

  // Раскрытие живёт до перезагрузки страницы и хранится отдельно от карточки
  // (PLY-05): в кэше запроса оно пережило бы уход и возврат на экран, а
  // раскрытие — разовое действие с записью в журнал.
  const [revealed, setRevealed] = useState<Record<number, string> | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  useEffect(() => {
    setRevealed(null);
    setRevealError(null);
  }, []);

  const data = card.data;
  const segments = useMemo(() => data?.segments ?? [], [data]);
  const hits = useMemo(() => data?.hit_seqs ?? [], [data]);
  const duration = data?.duration_s ?? 0;
  const hasAudio = data?.audio_status === 'stored';

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, seconds);
    setPosition(audio.currentTime);
  }, []);

  // Позиция из адреса применяется один раз, когда метаданные уже загружены:
  // до этого `currentTime` присвоить нельзя — браузер молча его отбросит.
  const appliedStart = useRef(false);
  useEffect(() => {
    if (appliedStart.current || !hasAudio || startAt <= 0) return;
    appliedStart.current = true;
    seek(startAt);
  }, [hasAudio, startAt, seek]);

  const currentSeq = useMemo(() => {
    const ms = position * 1000;
    let found = -1;
    for (const segment of segments) {
      if (segment.start_ms <= ms) found = segment.seq;
      else break;
    }
    return found;
  }, [position, segments]);

  function goToHit(next: number) {
    if (hits.length === 0) return;
    // По кругу (PLY-03): «след.» на последнем совпадении возвращает к первому,
    // иначе кнопка просто перестаёт работать и выглядит сломанной.
    const index = ((next % hits.length) + hits.length) % hits.length;
    setHitIndex(index);
    const seq = hits[index];
    const target = segments.find((segment) => segment.seq === seq);
    if (target) seek(target.start_ms / 1000);
  }

  async function reveal() {
    setRevealError(null);
    try {
      const body = await request<RevealResponse>(`/api/v1/calls/${callId}/reveal`, {
        method: 'POST',
      });
      const bySeq: Record<number, string> = {};
      for (const segment of body.segments ?? []) bySeq[segment.seq] = segment.text_raw;
      setRevealed(bySeq);
    } catch (error) {
      setRevealError(
        error instanceof ApiError && error.kind === 'forbidden'
          ? 'Недостаточно прав для раскрытия.'
          : 'Не удалось раскрыть текст.',
      );
    }
  }

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
      setTimeout(() => setCopied(false), 2000);
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
        <button type="button" className={styles.button} onClick={onClose}>
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
        <span className={styles.spacer} />
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
        <button type="button" className={styles.button} onClick={onClose} aria-label="Закрыть">
          ✕
        </button>
      </header>

      <div className={styles.meta}>
        {/* Источник — первым и словами (S-35). Раньше звонок Телфина отличался
            только названием проекта, а карточка открывается и по прямой ссылке,
            где вкладки рядом может не быть. */}
        <span className={styles.source}>{SOURCE_LABEL[data.source] ?? data.source}</span>
        <span>{formatDateTime(data.started_at)}</span>
        <span>{data.operator_login || 'оператор не указан'}</span>
        <span>{formatDuration(data.duration_s)}</span>
        {data.project_title ? <span>{data.project_title}</span> : null}
        {data.sentiment ? <span>{SENTIMENT_LABEL[data.sentiment] ?? data.sentiment}</span> : null}
        {data.segment ? (
          <span>
            {SEGMENT_LABEL[data.segment] ?? data.segment}
            {data.segment_source === 'llm' ? ' ?' : ''}
          </span>
        ) : null}
        {data.product ? (
          <span>
            {PRODUCT_LABEL[data.product] ?? data.product}
            {data.product_source === 'llm' ? ' ?' : ''}
          </span>
        ) : null}
      </div>

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
        <>
          {/* biome-ignore lint/a11y/useMediaCaption: субтитры — это и есть транскрипт ниже */}
          <audio
            ref={audioRef}
            src={audioUrl(callId)}
            preload="metadata"
            onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
          {/* PLY-03: полоса с метками совпадений и текущей позицией */}
          <div
            className={styles.track}
            role="slider"
            tabIndex={0}
            aria-label="Позиция в записи"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={Math.floor(position)}
            aria-valuetext={`${formatDuration(position)} из ${formatDuration(duration)}`}
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              seek(((event.clientX - box.left) / box.width) * duration);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') seek(position + 5);
              if (event.key === 'ArrowLeft') seek(position - 5);
            }}
          >
            <div
              className={styles.played}
              style={{ width: `${duration ? (position / duration) * 100 : 0}%` }}
            />
            {hits.map((seq, index) => {
              const segment = segments.find((item) => item.seq === seq);
              if (!segment || !duration) return null;
              return (
                <div
                  key={seq}
                  className={`${styles.hit} ${index === hitIndex ? styles.hitCurrent : ''}`}
                  style={{
                    left: `${(segment.start_ms / 1000 / duration) * 100}%`,
                    width: `${((segment.end_ms - segment.start_ms) / 1000 / duration) * 100}%`,
                  }}
                />
              );
            })}
            <div
              className={styles.cursor}
              style={{ left: `${duration ? (position / duration) * 100 : 0}%` }}
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.button} ${styles.primary}`}
              onClick={() => {
                const audio = audioRef.current;
                if (!audio) return;
                if (audio.paused) void audio.play();
                else audio.pause();
              }}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <span className={styles.time}>
              {formatDuration(position)} / {formatDuration(duration)}
            </span>
            <span className={styles.spacer} />
            {SPEEDS.map((value) => (
              <button
                type="button"
                key={value}
                className={`${styles.button} ${speed === value ? styles.active : ''}`}
                onClick={() => {
                  setSpeed(value);
                  if (audioRef.current) audioRef.current.playbackRate = value;
                }}
              >
                {value}×
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.note}>{note ?? 'Запись недоступна — транскрипт доступен'}</div>
      )}

      <div className={styles.actions}>
        {hits.length > 0 ? (
          <>
            <button type="button" className={styles.button} onClick={() => goToHit(hitIndex - 1)}>
              ← пред.
            </button>
            <span className={styles.counter}>
              совпадение {hitIndex + 1} из {hits.length}
            </span>
            <button type="button" className={styles.button} onClick={() => goToHit(hitIndex + 1)}>
              след. →
            </button>
          </>
        ) : null}
        <span className={styles.spacer} />
        {session.can(PERM_REVEAL_PII) && !revealed ? (
          <button type="button" className={styles.button} onClick={reveal}>
            Показать скрытое
          </button>
        ) : null}
        {revealed ? <span className={styles.counter}>исходный текст показан</span> : null}
      </div>

      {revealError ? (
        <div className={`${styles.note} ${styles.error}`} role="alert">
          {revealError}
        </div>
      ) : null}

      <div className={styles.transcriptHead}>
        <h3 className={styles.transcriptTitle}>Транскрипт</h3>
        <span className={styles.spacer} />
        {/* Легенда: кружок плюс слово. Один цвет без подписи ничего не
            сообщает тому, кто их не различает. */}
        <span className={styles.legend}>
          <span className={`${styles.legendDot} ${styles.legendOperator}`} aria-hidden="true" />
          оператор
          <span className={`${styles.legendDot} ${styles.legendClient}`} aria-hidden="true" />
          клиент
        </span>
      </div>

      <div className={styles.transcript}>
        {segments.map((segment) => (
          <button
            type="button"
            key={segment.seq}
            className={[
              styles.reply,
              segment.seq === currentSeq ? styles.playing : '',
              hits[hitIndex] === segment.seq ? styles.current : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => {
              seek(segment.start_ms / 1000);
              const index = hits.indexOf(segment.seq);
              if (index >= 0) setHitIndex(index);
            }}
          >
            <span className={styles.replyTime}>{formatDuration(segment.start_ms / 1000)}</span>
            <span
              className={`${styles.role} ${segment.speaker === 'operator' ? styles.operator : ''}`}
            >
              {segment.speaker === 'operator' ? 'оператор' : 'клиент'}
            </span>
            <span className={styles.text}>
              <ReplyText
                text={revealed?.[segment.seq] ?? segment.text}
                // Пометка ставится только там, где маска действительно была.
                // Иначе после раскрытия подчёркнутым оказывается весь разговор,
                // и понять, где именно были скрыты данные, уже нельзя — а это
                // единственное, ради чего кнопку нажимали.
                revealed={
                  revealed !== null &&
                  revealed[segment.seq] !== undefined &&
                  revealed[segment.seq] !== stripHighlight(segment.text)
                }
              />
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

/**
 * Текст реплики: подсветка найденного и штриховка на месте маски (PLY-04,
 * PLY-05).
 *
 * Маска показывается видимой штриховкой, а не многоточием: скрытое должно быть
 * видно как скрытое. Иначе `•••` читается как оговорка или пауза, и человек не
 * понимает, что здесь что-то есть.
 */
function ReplyText({ text, revealed }: { text: string; revealed: boolean }) {
  return (
    <>
      {splitHighlight(text).map((piece) => {
        if (piece.marked) {
          return (
            <mark key={piece.offset} className={styles.mark}>
              {piece.text}
            </mark>
          );
        }
        if (revealed) {
          return (
            <span key={piece.offset} className={styles.revealed}>
              {piece.text}
            </span>
          );
        }
        // Штриховка на месте маски. Ключи — тоже смещения: кусок текста и
        // следующая за ним маска стоят на своих местах в реплике.
        const chunks = piece.text.split(MASK);
        let inner = piece.offset;
        return (
          <span key={piece.offset}>
            {chunks.map((chunk, position) => {
              const at = inner;
              inner += chunk.length + MASK.length;
              return (
                <span key={at}>
                  {chunk}
                  {position < chunks.length - 1 ? (
                    <span className={styles.masked}>{MASK}</span>
                  ) : null}
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
}
