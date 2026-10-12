'use client';

import { useState } from 'react';
import { PERM_EXPORT, useSession } from '@/entities/session';
import { displayTimeZone } from '@/shared/config';
import { kit } from '@/shared/ui/analytics-kit';
import { downloadReview } from '../model/review-file';
import type { QualityState } from '../model/state';

/**
 * Кнопка «Выгрузить для проверки»: файл Excel для контролёра.
 *
 * Видна с правом `export`: файл уходит из системы, и сервер без этого права
 * откажет. Кнопка, которая всегда отвечает отказом, хуже её отсутствия.
 *
 * Состояние отказа живёт, пока не сменился охват: родитель ставит охват в
 * `key`, и сообщение «за период нечего сверять» не переезжает в другой период.
 *
 * @param props Свойства компонента.
 * @param props.state Охват экрана: период и сотрудник.
 * @param props.available Есть ли в охвате хоть один звонок, оценённый по скрипту.
 * @returns Кнопка и, после отказа, строка с причиной; `null` без права `export`.
 */
export function ReviewFile({
  state,
  available,
}: {
  state: Pick<QualityState, 'from' | 'to' | 'operator'>;
  available: boolean;
}) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  if (!session.can(PERM_EXPORT)) return null;

  /**
   * Скачивает файл сверки; отказ показывает словами рядом с кнопкой.
   */
  async function download() {
    setBusy(true);
    setRefusal(null);
    try {
      await downloadReview(state, displayTimeZone());
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
        className={kit.ghost}
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
        <span className={`${kit.hint} ${kit.alert}`} role="alert">
          {refusal}
        </span>
      ) : null}
    </>
  );
}
