'use client';

import { useState } from 'react';
import { PERM_EXPORT, useSession } from '@/entities/session';
import { displayTimeZone } from '@/shared/config';
import { downloadFile } from '@/shared/lib/download';
import { kit } from '@/shared/ui/analytics-kit';
import { type DashboardState, exportHref } from '../model/dashboard';

/**
 * Объясняет отказ выгрузки словами.
 *
 * @param status Код ответа HTTP.
 * @param detail Причина отказа из ответа сервера.
 * @returns Текст для строки отказа.
 */
function refusalText(status: number, detail: string): string {
  if (status === 401) return 'Сессия истекла: нужно обновить страницу и войти заново.';
  if (status === 403) return 'Нет права на выгрузку.';
  return `Файл не собран: сервер ответил ${status}${detail ? ` (${detail})` : ''}.`;
}

/**
 * Кнопка выгрузки чисел дашборда в Excel: столбцы по времени, все темы и подтемы за выбранный
 * период.
 *
 * Видна с правом `export`, как остальные выгрузки: файл уходит из системы, и
 * сервер без этого права откажет. Отказ показывается словами — ссылкой
 * `<a download>` браузер сохранил бы тело ошибки файлом.
 *
 * @param props Свойства компонента.
 * @param props.state Состояние экрана: период и корзина уходят в файл.
 * @returns Кнопка и, после отказа, строка с причиной; `null` без права `export`.
 */
export function ExportFile({ state }: { state: DashboardState }) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  if (!session.can(PERM_EXPORT)) return null;

  /**
   * Скачивает файл выгрузки; отказ показывает словами под кнопкой.
   */
  async function run() {
    setBusy(true);
    setRefusal(null);
    try {
      await downloadFile(
        exportHref(state, displayTimeZone()),
        `dashboard-${state.from}_${state.to}.xlsx`,
        refusalText,
      );
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
        disabled={busy}
        title="Файл Excel: обращения по темам во времени, все темы и подтемы за период. Выгрузка записывается в журнал."
        onClick={() => void run()}
      >
        {busy ? 'Собираем файл…' : 'Экспорт в Excel'}
      </button>
      {refusal ? (
        <span className={`${kit.hint} ${kit.alert}`} role="alert">
          {refusal}
        </span>
      ) : null}
    </>
  );
}
