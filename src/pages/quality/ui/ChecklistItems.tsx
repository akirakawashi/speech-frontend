'use client';

import type { StageState } from '@/entities/evaluation';
import { formatDuration } from '@/shared/lib/format';
import type { ChecklistItem } from '../model/checklist';
import styles from './ChecklistItems.module.css';
import review from './review.module.css';

const MARK: Record<StageState, string> = { done: '✓', failed: '✗', skipped: '—' };

const MARK_TONE: Record<StageState, string | undefined> = {
  done: styles.done,
  failed: styles.failed,
  skipped: styles.skipped,
};

/**
 * Показывает пункты чек-листа: этапы скрипта или возражения клиента.
 *
 * @param props Свойства компонента.
 * @param props.items Пункты чек-листа.
 * @param props.picked Идентификатор выбранного пункта; `null` — не выбран ни один.
 * @param props.starts Начало каждой реплики в миллисекундах, по номеру реплики.
 * @param props.onPick Вызывается с пунктом, по которому кликнули.
 * @param props.onListen Вызывается с пунктом и номером реплики, чью метку времени нажали.
 * @returns Список пунктов с вердиктом, пояснением модели и метками времени.
 */
export function ChecklistItems({
  items,
  picked,
  starts,
  onPick,
  onListen,
}: {
  items: readonly ChecklistItem[];
  picked: string | null;
  starts: ReadonlyMap<number, number>;
  onPick: (item: ChecklistItem) => void;
  onListen: (item: ChecklistItem, seq: number) => void;
}) {
  return (
    <ul className={styles.items}>
      {items.map((item) => {
        const seqs = item.seqs.filter((seq) => starts.has(seq));
        return (
          <li
            key={item.id}
            className={`${styles.item} ${picked === item.id ? styles.itemPicked : ''}`}
          >
            <button
              type="button"
              className={styles.itemHead}
              aria-pressed={picked === item.id}
              onClick={() => onPick(item)}
            >
              <span
                className={`${styles.mark} ${MARK_TONE[item.state]}`}
                title={item.verdict}
                aria-hidden="true"
              >
                {MARK[item.state]}
              </span>
              <span className={styles.num}>{item.num}</span>
              <span>
                {item.label}
                <span className={styles.srOnly}> — {item.verdict}</span>
                {item.mandatory ? <span className={styles.tag}>обязательный</span> : null}
              </span>
            </button>
            {item.comment || seqs.length > 0 ? (
              <div className={styles.itemBody}>
                {item.comment ? <p className={review.comment}>{item.comment}</p> : null}
                {seqs.length > 0 ? (
                  <div className={styles.times}>
                    {seqs.map((seq) => (
                      <button
                        type="button"
                        key={seq}
                        className={styles.timeChip}
                        title="слушать с этой реплики"
                        onClick={() => onListen(item, seq)}
                      >
                        {formatDuration((starts.get(seq) ?? 0) / 1000)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
