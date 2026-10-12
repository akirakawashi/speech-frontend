'use client';

import {
  audioUrl,
  PLAYBACK_SPEEDS,
  type RecordingPlayer,
  type SegmentModel,
} from '@/entities/call';
import { formatDuration } from '@/shared/lib/format';
import common from './common.module.css';
import styles from './PanelPlayer.module.css';

/** На сколько секунд сдвигает позицию стрелка клавиатуры на полосе записи. */
const KEY_STEP_S = 5;

/**
 * Показывает плеер записи: полосу с метками совпадений и кнопки управления
 * (PLY-02, PLY-03).
 *
 * Полоса — и шкала, и перемотка: клик ставит позицию, стрелки сдвигают её на
 * пять секунд. Метки на полосе — реплики с совпадениями поискового запроса.
 *
 * @param props Свойства компонента.
 * @param props.callId Идентификатор звонка: по нему строится адрес записи.
 * @param props.player Состояние плеера и действия над ним.
 * @param props.duration Длительность записи в секундах.
 * @param props.segments Реплики расшифровки: по ним метки встают на своё время.
 * @param props.hits Номера реплик с совпадениями.
 * @param props.hitIndex Порядковый номер текущего совпадения среди `hits`.
 * @returns Тег `<audio>`, полоса записи и ряд кнопок.
 */
export function PanelPlayer({
  callId,
  player,
  duration,
  segments,
  hits,
  hitIndex,
}: {
  callId: string;
  player: RecordingPlayer;
  duration: number;
  segments: readonly SegmentModel[];
  hits: readonly number[];
  hitIndex: number;
}) {
  const { audioRef, audioEvents, position, playing, speed, seek } = player;
  return (
    <>
      {/* Дорожки субтитров нет: её заменяет транскрипт ниже. */}
      <audio ref={audioRef} src={audioUrl(callId)} preload="metadata" {...audioEvents} />
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
          if (event.key === 'ArrowRight') seek(position + KEY_STEP_S);
          if (event.key === 'ArrowLeft') seek(position - KEY_STEP_S);
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

      <div className={common.actions}>
        <button
          type="button"
          className={`${common.button} ${common.primary}`}
          onClick={player.toggle}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <span className={styles.time}>
          {formatDuration(position)} / {formatDuration(duration)}
        </span>
        <span className={common.spacer} />
        {PLAYBACK_SPEEDS.map((value) => (
          <button
            type="button"
            key={value}
            className={`${common.button} ${speed === value ? common.active : ''}`}
            onClick={() => player.setSpeed(value)}
          >
            {value}×
          </button>
        ))}
      </div>
    </>
  );
}
