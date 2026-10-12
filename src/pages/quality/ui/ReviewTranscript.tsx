'use client';

import type { RefObject } from 'react';
import type { SegmentModel } from '@/entities/call';
import { formatDuration } from '@/shared/lib/format';
import styles from './ReviewTranscript.module.css';
import review from './review.module.css';

/**
 * Называет роль говорящего словами.
 *
 * @param speaker Роль из расшифровки: `operator`, `client` или иное значение, пока роли не определены.
 * @returns Подпись роли в разговоре.
 */
function roleLabel(speaker: string): string {
  if (speaker === 'operator') return 'оператор';
  if (speaker === 'client') return 'клиент';
  return 'не определён';
}

/**
 * Показывает разговор в разборе звонка по репликам.
 *
 * Реплика — кнопка: клик включает запись с её начала. Отмечены три вида
 * реплик: звучащая сейчас, принадлежащие выбранному пункту чек-листа и те, на
 * которые ссылается невыполненный пункт.
 *
 * @param props Свойства компонента.
 * @param props.segments Реплики расшифровки по порядку.
 * @param props.playingSeq Номер звучащей реплики; `-1` — запись стоит или не дошла до первой.
 * @param props.pickedSeqs Реплики выбранного пункта чек-листа.
 * @param props.flaggedSeqs Реплики невыполненных пунктов.
 * @param props.replyRefs Кнопки реплик по номерам: по ним разбор прокручивает разговор к нужной реплике.
 * @param props.onListen Вызывается с репликой, по которой кликнули.
 * @returns Колонка с репликами разговора.
 */
export function ReviewTranscript({
  segments,
  playingSeq,
  pickedSeqs,
  flaggedSeqs,
  replyRefs,
  onListen,
}: {
  segments: readonly SegmentModel[];
  playingSeq: number;
  pickedSeqs: ReadonlySet<number>;
  flaggedSeqs: ReadonlySet<number>;
  replyRefs: RefObject<Map<number, HTMLButtonElement>>;
  onListen: (segment: SegmentModel) => void;
}) {
  const rolesKnown = segments.some(
    (segment) => segment.speaker === 'operator' || segment.speaker === 'client',
  );
  return (
    <section className={review.column} aria-label="Разговор">
      <h3 className={review.columnTitle}>Разговор</h3>
      {segments.length > 0 && !rolesKnown ? (
        <p className={review.comment}>Роли оператора и клиента пока не определены.</p>
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
              segment.seq === playingSeq ? styles.replyPlaying : '',
              pickedSeqs.has(segment.seq) ? styles.replyPicked : '',
              flaggedSeqs.has(segment.seq) ? styles.replyFlagged : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={pickedSeqs.has(segment.seq) ? 'true' : undefined}
            onClick={() => onListen(segment)}
          >
            <span className={styles.replyTime}>{formatDuration(segment.start_ms / 1000)}</span>
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
  );
}
