'use client';

import { splitHighlight } from '@/shared/lib/highlight';
import styles from './ReplyText.module.css';

/**
 * Показывает текст реплики с подсветкой найденного (PLY-04).
 *
 * @param props Свойства компонента.
 * @param props.text Текст реплики с метками подсветки.
 * @returns Куски текста реплики: найденное — в `<mark>`.
 */
export function ReplyText({ text }: { text: string }) {
  return (
    <>
      {splitHighlight(text).map((piece) =>
        piece.marked ? (
          <mark key={piece.offset} className={styles.mark}>
            {piece.text}
          </mark>
        ) : (
          <span key={piece.offset}>{piece.text}</span>
        ),
      )}
    </>
  );
}
