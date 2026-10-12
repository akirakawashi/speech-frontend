'use client';

import { useState } from 'react';
import quality from '@/app/quality/quality.module.css';
import { currentConfig } from '@/lib/config';
import { type DashboardState, exportHref } from '@/lib/dashboard';
import { downloadFile } from '@/lib/download';
import { PERM_EXPORT, useSession } from '@/lib/session';

function refusalText(status: number, detail: string): string {
  if (status === 401) return 'Сессия истекла: нужно обновить страницу и войти заново.';
  if (status === 403) return 'Нет права на выгрузку.';
  return `Файл не собран: сервер ответил ${status}${detail ? ` (${detail})` : ''}.`;
}

/**
 * Выгрузка чисел дашборда в Excel: столбцы по времени, все темы и подтемы за
 * выбранный период.
 *
 * Видна с правом `export`, как остальные выгрузки: файл уходит из системы, и
 * сервер без этого права откажет. Отказ показывается словами — ссылкой
 * `<a download>` браузер сохранил бы тело ошибки файлом.
 */
export function ExportFile({ state }: { state: DashboardState }) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  if (!session.can(PERM_EXPORT)) return null;

  async function run() {
    setBusy(true);
    setRefusal(null);
    try {
      const timeZone = currentConfig().displayTimezone || 'Europe/Moscow';
      await downloadFile(
        exportHref(state, timeZone),
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
        className={quality.ghost}
        disabled={busy}
        title="Файл Excel: обращения по темам во времени, все темы и подтемы за период. Выгрузка записывается в журнал."
        onClick={() => void run()}
      >
        {busy ? 'Собираем файл…' : 'Экспорт в Excel'}
      </button>
      {refusal ? (
        <span className={`${quality.hint} ${quality.alert}`} role="alert">
          {refusal}
        </span>
      ) : null}
    </>
  );
}
