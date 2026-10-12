'use client';

import {
  type ReactEventHandler,
  type RefObject,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

/** Скорости воспроизведения (PLY-02). Больше двух — уже неразборчиво. */
export const PLAYBACK_SPEEDS = [1, 1.5, 2] as const;

/** Скорость воспроизведения записи — одна из предложенных. */
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/** Состояние плеера записи и действия над ним. */
export type RecordingPlayer = {
  /** Ссылка на тег `<audio>`: её получает разметка плеера. */
  audioRef: RefObject<HTMLAudioElement | null>;
  /** Текущая позиция в записи, в секундах. */
  position: number;
  /** Идёт ли воспроизведение. */
  playing: boolean;
  /** Выбранная скорость. */
  speed: PlaybackSpeed;
  /** Перематывает запись; при `play` заодно включает её. */
  seek: (seconds: number, play?: boolean) => void;
  /** Включает запись или ставит её на паузу. */
  toggle: () => void;
  /** Меняет скорость воспроизведения. */
  setSpeed: (speed: PlaybackSpeed) => void;
  /** Обработчики событий тега `<audio>`: по ним обновляются позиция и состояние. */
  audioEvents: {
    onTimeUpdate: ReactEventHandler<HTMLAudioElement>;
    onPlay: () => void;
    onPause: () => void;
  };
};

/**
 * Включает запись, не роняя обещание на отказе браузера.
 *
 * Браузер вправе отказать в воспроизведении — например, без жеста пользователя.
 * Перемотка к этому моменту уже сделана, и отказ не должен становиться ошибкой.
 *
 * @param audio Тег `<audio>` плеера.
 */
function play(audio: HTMLAudioElement): void {
  Promise.resolve(audio.play()).catch(() => undefined);
}

/**
 * Держит состояние плеера записи разговора: позицию, воспроизведение и скорость.
 *
 * Плееров в приложении два — в панели разговора и в разборе звонка. Разметка у
 * них разная, а поведение обязано быть одним: перемотка, пауза и скорость.
 *
 * @returns Состояние плеера, действия над ним и обработчики для тега `<audio>`.
 */
export function useRecordingPlayer(): RecordingPlayer {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedValue] = useState<PlaybackSpeed>(1);

  /**
   * Перематывает запись на заданную секунду.
   *
   * @param seconds Позиция в секундах; отрицательная приводится к началу.
   * @param start Включить ли воспроизведение после перемотки.
   */
  const seek = useCallback((seconds: number, start = false) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, seconds);
    setPosition(audio.currentTime);
    if (start) play(audio);
  }, []);

  /** Включает запись, если она стоит, и ставит на паузу, если идёт. */
  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) play(audio);
    else audio.pause();
  }, []);

  /**
   * Меняет скорость воспроизведения.
   *
   * @param value Новая скорость.
   */
  const setSpeed = useCallback((value: PlaybackSpeed) => {
    setSpeedValue(value);
    if (audioRef.current) audioRef.current.playbackRate = value;
  }, []);

  const audioEvents = useMemo<RecordingPlayer['audioEvents']>(
    () => ({
      onTimeUpdate: (event) => setPosition(event.currentTarget.currentTime),
      onPlay: () => setPlaying(true),
      onPause: () => setPlaying(false),
    }),
    [],
  );

  return { audioRef, position, playing, speed, seek, toggle, setSpeed, audioEvents };
}
