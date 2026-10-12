'use client';

import { useState } from 'react';
import styles from '@/app/quality/quality.module.css';
import { currentConfig } from '@/lib/config';
import type { QualityState } from '@/lib/quality';
import { downloadReview } from '@/lib/quality-review';
import { PERM_EXPORT, useSession } from '@/lib/session';

/**
 * Кнопка «Выгрузить для проверки»: файл Excel для контролёра — случайные
 * оценённые звонки охвата, оценка модели по каждому этапу и текст разговора.
 *
 * Видна с правом `export`: файл уходит из системы, и сервер без этого права
 * откажет. Кнопка, которая всегда отвечает отказом, хуже её отсутствия.
 *
 * Состояние отказа живёт, пока не сменился охват: родитель ставит охват в
 * `key`, и сообщение «за период нечего сверять» не переезжает в другой период.
 */
export function ReviewFile({
  state,
  available,
}: {
  state: Pick<QualityState, 'from' | 'to' | 'operator'>;
  /** Есть ли в охвате хоть один звонок, оценённый по скрипту. */
  available: boolean;
}) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  if (!session.can(PERM_EXPORT)) return null;

  async function download() {
    setBusy(true);
    setRefusal(null);
    try {
      await downloadReview(state, currentConfig().displayTimezone || 'Europe/Moscow');
    } catch (error) {
      setRefusal(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.ghost}
        disabled={busy || !available}
        title={
          available
            ? 'Файл Excel: 30 случайных оценённых звонков периода — оценка модели по каждому этапу, её пояснение и текст разговора. Выгрузка записывается в журнал.'
            : 'За период нет звонков, оценённых по скрипту'
        }
        onClick={() => void download()}
      >
        {busy ? 'Собираем файл…' : 'Выгрузить для проверки'}
      </button>
      {refusal ? (
        <span className={`${styles.hint} ${styles.alert}`} role="alert">
          {refusal}
        </span>
      ) : null}
    </>
  );
}
