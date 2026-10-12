'use client';

import type { SegmentModel } from '@/entities/call';
import { formatDuration } from '@/shared/lib/format';
import { stripHighlight } from '@/shared/lib/highlight';
import common from './common.module.css';
import { ReplyText } from './ReplyText';
import styles from './Transcript.module.css';

/**
 * Показывает транскрипт разговора по репликам (PLY-04).
 *
 * Реплика — кнопка: клик перематывает запись на её начало. Легенда над
 * репликами — кружок плюс слово: один цвет без подписи ничего не сообщает
 * тому, кто цвета не различает.
 *
 * @param props Свойства компонента.
 * @param props.segments Реплики расшифровки по порядку.
 * @param props.playingSeq Номер реплики, которая звучит сейчас; `-1` — ни одна.
 * @param props.hitSeq Номер реплики с текущим совпадением поиска.
 * @param props.revealed Исходный текст по номерам реплик; `null` — скрытое не раскрывали.
 * @param props.onPick Вызывается с репликой, по которой кликнули.
 * @returns Заголовок с легендой и список реплик.
 */
export function Transcript({
  segments,
  playingSeq,
  hitSeq,
  revealed,
  onPick,
}: {
  segments: readonly SegmentModel[];
  playingSeq: number;
  hitSeq: number | undefined;
  revealed: Record<number, string> | null;
  onPick: (segment: SegmentModel) => void;
}) {
  return (
    <>
      <div className={styles.transcriptHead}>
        <h3 className={styles.transcriptTitle}>Транскрипт</h3>
        <span className={common.spacer} />
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
              segment.seq === playingSeq ? styles.playing : '',
              hitSeq === segment.seq ? styles.current : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onPick(segment)}
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
    </>
  );
}
