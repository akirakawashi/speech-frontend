'use client';

import { splitHighlight } from '@/shared/lib/highlight';
import styles from './ReplyText.module.css';

/** Маска, которую ставит обезличивание. Совпадает с `MASK` на сервере. */
const MASK = '•••';

/**
 * Показывает текст реплики: подсветка найденного и штриховка на месте маски (PLY-04, PLY-05).
 *
 * Маска показывается видимой штриховкой, а не многоточием: скрытое должно быть
 * видно как скрытое. Иначе `•••` читается как оговорка или пауза, и человек не
 * понимает, что здесь что-то есть.
 *
 * @param props Свойства компонента.
 * @param props.text Текст реплики с метками подсветки.
 * @param props.revealed Исходный текст показан на месте маски — его надо отметить.
 * @returns Куски текста реплики.
 */
export function ReplyText({ text, revealed }: { text: string; revealed: boolean }) {
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
