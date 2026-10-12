/**
 * Файл «Сверка оценок» для контролёра: адрес выгрузки, имя файла и отказ словами.
 *
 * Охват — тот же, что у сводки: период и сотрудник (`scopeQuery`). Отбор списка
 * в файл не идёт: сверяется модель, а не худшие звонки, и сервер сам берёт
 * случайную выборку из оценённых по скрипту.
 */

import { apiUrl } from '@/api/client';
import { downloadFile, filenameFrom } from '@/lib/download';
import { type QualityState, scopeQuery } from '@/lib/quality';

type Scope = Pick<QualityState, 'from' | 'to' | 'operator'>;

export function reviewHref(state: Scope, timeZone: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(scopeQuery(state, timeZone))) {
    if (value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  return `${apiUrl('/api/v1/quality/review.xlsx')}?${params.toString()}`;
}

/** Имя файла из `Content-Disposition`; нет — собранное из периода, как у сервера. */
export function reviewFilename(disposition: string | null, state: Scope): string {
  return filenameFrom(disposition, `quality-review-${state.from}_${state.to}.xlsx`);
}

/**
 * Отказ сервера словами. Ссылкой `<a download>` отказ не показать: браузер
 * сохранил бы тело ошибки файлом. «Нечего сверять» — не сбой, а ответ: в
 * периоде нет ни одного звонка, оценённого по скрипту.
 */
export function reviewRefusalText(status: number, detail: string): string {
  if (detail === 'nothing_to_review') {
    return 'За период нет звонков, оценённых по скрипту: сверять нечего.';
  }
  if (status === 401) return 'Сессия истекла: нужно обновить страницу и войти заново.';
  if (status === 403) return 'Нет права на выгрузку.';
  return `Файл не собран: сервер ответил ${status}${detail ? ` (${detail})` : ''}.`;
}

/** Скачать файл сверки за охват экрана; отказ — исключением со словами. */
export async function downloadReview(state: Scope, timeZone: string): Promise<void> {
  await downloadFile(reviewHref(state, timeZone), reviewFilename(null, state), reviewRefusalText);
}
