/**
 * Файл «Сверка оценок» для контролёра: адрес выгрузки, имя файла и отказ словами.
 *
 * Охват — тот же, что у сводки: период и сотрудник (`scopeQuery`). Отбор списка
 * в файл не идёт: сверяется модель, а не худшие звонки, и сервер сам берёт
 * случайную выборку из оценённых по скрипту.
 */

import { apiUrl } from '@/shared/api';
import { downloadFile } from '@/shared/lib/download';
import { scopeQuery } from './queries';
import type { QualityState } from './state';

type Scope = Pick<QualityState, 'from' | 'to' | 'operator'>;

/**
 * Строит адрес файла «Сверка оценок».
 *
 * @param state Охват экрана: период и сотрудник.
 * @param timeZone Часовой пояс показа.
 * @returns Адрес файла Excel на API.
 */
export function reviewHref(state: Scope, timeZone: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(scopeQuery(state, timeZone))) {
    if (value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  return `${apiUrl('/api/v1/quality/review.xlsx')}?${params.toString()}`;
}

/**
 * Собирает имя файла сверки из периода — как у сервера.
 *
 * Нужно на случай, если сервер имени не назвал: имя из ответа подставляет само
 * скачивание.
 *
 * @param state Охват экрана: период.
 * @returns Имя файла вида `quality-review-<начало>_<конец>.xlsx`.
 */
export function reviewFilename(state: Scope): string {
  return `quality-review-${state.from}_${state.to}.xlsx`;
}

/**
 * Объясняет отказ выгрузки словами.
 *
 * Ссылкой `<a download>` отказ не показать: браузер сохранил бы тело ошибки файлом. «Нечего
 * сверять» — не сбой, а ответ: в периоде нет ни одного звонка, оценённого по скрипту.
 *
 * @param status Код ответа HTTP.
 * @param detail Причина отказа из ответа сервера.
 * @returns Текст для строки отказа.
 */
export function reviewRefusalText(status: number, detail: string): string {
  if (detail === 'nothing_to_review') {
    return 'За период нет звонков, оценённых по скрипту: сверять нечего.';
  }
  if (status === 401) return 'Сессия истекла: нужно обновить страницу и войти заново.';
  if (status === 403) return 'Нет права на выгрузку.';
  return `Файл не собран: сервер ответил ${status}${detail ? ` (${detail})` : ''}.`;
}

/**
 * Скачивает файл сверки за охват экрана.
 *
 * @param state Охват экрана: период и сотрудник.
 * @param timeZone Часовой пояс показа.
 * @throws {Error} Сервис недоступен или ответил отказом; текст ошибки показывается пользователю.
 */
export async function downloadReview(state: Scope, timeZone: string): Promise<void> {
  await downloadFile(reviewHref(state, timeZone), reviewFilename(state), reviewRefusalText);
}
