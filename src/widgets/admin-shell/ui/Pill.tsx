'use client';
import styles from './Pill.module.css';

/**
 * Показывает состояние задания или полосы меткой: цвет плюс слово, никогда только цвет.
 *
 * @param props Свойства компонента.
 * @param props.value Текст метки.
 * @param props.tone Оттенок метки: `ok`, `warn`, `bad` или `plain`.
 * @returns Метка-пилюля.
 */
export function Pill({ value, tone }: { value: string; tone: 'ok' | 'warn' | 'bad' | 'plain' }) {
  const cls =
    tone === 'ok'
      ? styles.pillOk
      : tone === 'warn'
        ? styles.pillWarn
        : tone === 'bad'
          ? styles.pillBad
          : '';
  return <span className={`${styles.pill} ${cls}`}>{value}</span>;
}
