'use client';

import { audioUrl, PLAYBACK_SPEEDS, type RecordingPlayer } from '@/entities/call';
import { formatDuration } from '@/shared/lib/format';
import styles from './ReviewPlayer.module.css';
import review from './review.module.css';

/**
 * Показывает плеер записи в разборе звонка: кнопку, ползунок и скорости.
 *
 * @param props Свойства компонента.
 * @param props.callId Идентификатор звонка: по нему строится адрес записи.
 * @param props.player Состояние плеера и действия над ним.
 * @param props.duration Длительность записи в секундах.
 * @returns Строка плеера с тегом `<audio>`.
 */
export function ReviewPlayer({
  callId,
  player,
  duration,
}: {
  callId: string;
  player: RecordingPlayer;
  duration: number;
}) {
  const { audioRef, audioEvents, position, playing, speed } = player;
  // Ползунку нужна ненулевая длина: у записи короче секунды он бы не двигался.
  const last = Math.max(1, Math.floor(duration));
  return (
    <div className={styles.player}>
      {/* Дорожки субтитров нет: её заменяет разговор справа. */}
      <audio ref={audioRef} src={audioUrl(callId)} preload="metadata" {...audioEvents} />
      <button
        type="button"
        className={`${review.button} ${review.primary}`}
        aria-label={playing ? 'Пауза' : 'Слушать'}
        onClick={player.toggle}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <input
        type="range"
        className={styles.range}
        aria-label="Позиция в записи"
        min={0}
        max={last}
        step={1}
        value={Math.min(Math.floor(position), last)}
        onChange={(event) => player.seek(Number(event.target.value), false)}
      />
      <span className={styles.time}>
        {formatDuration(position)} / {formatDuration(duration)}
      </span>
      {PLAYBACK_SPEEDS.map((value) => (
        <button
          type="button"
          key={value}
          className={`${review.button} ${speed === value ? review.active : ''}`}
          aria-pressed={speed === value}
          onClick={() => player.setSpeed(value)}
        >
          {value}×
        </button>
      ))}
    </div>
  );
}
