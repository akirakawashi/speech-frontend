/**
 * Отчёт по звонкам в Excel (SP-604, пять уровней с SP-310): фильтры формы и
 * адрес выгрузки.
 *
 * Даты — календарные дни колл-центра, обе включительно. Границы суток ставит
 * сервер в своём поясе: считать их здесь значило бы считать в поясе браузера, а
 * он у каждого свой.
 */

import { type CallSource, DEFAULT_SOURCE } from '@/entities/call';
import { apiUrl } from '@/shared/api';
import { isoDate } from '@/shared/lib/date';

export type ReportFilters = {
  /**
   * Чьи звонки (S-35). Один источник на отчёт: сервер их в один файл не
   * смешивает, и выбор здесь — единственный путь к отчёту Телфина без ручной
   * правки адреса.
   */
  source: CallSource;
  from: string;
  to: string;
  operatorId: string;
  /** Ветки классификатора: по классификации оператора и по классификации ИИ. */
  operatorNodeId: string;
  aiNodeId: string;
};

/** Сколько дней, включая сегодняшний, стоит в периоде по умолчанию. */
export const REPORT_DEFAULT_DAYS = 7;

/**
 * Строит фильтры отчёта по умолчанию: последние семь дней по NCC.
 *
 * @param now Текущий момент.
 * @returns Фильтры без оператора и узлов классификатора.
 */
export function defaultReportFilters(now: Date): ReportFilters {
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - (REPORT_DEFAULT_DAYS - 1));
  return {
    source: DEFAULT_SOURCE,
    from: isoDate(from),
    to: isoDate(now),
    operatorId: '',
    operatorNodeId: '',
    aiNodeId: '',
  };
}

/**
 * Собирает параметры выгрузки отчёта.
 *
 * Источник пустым не бывает и уходит всегда, как и у выдачи: запрос сам
 * называет, чьи звонки он просит, а не полагается на умолчание сервера.
 *
 * @param filters Фильтры формы.
 * @returns Параметры адреса; пустые фильтры в них не попадают.
 */
export function reportQuery(filters: ReportFilters): URLSearchParams {
  const params = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    source: filters.source,
  });
  if (filters.operatorId) params.set('operator_id', filters.operatorId);
  if (filters.operatorNodeId) params.set('operator_node_id', filters.operatorNodeId);
  if (filters.aiNodeId) params.set('ai_node_id', filters.aiNodeId);
  return params;
}

/**
 * Строит адрес файла отчёта.
 *
 * @param filters Фильтры формы.
 * @returns Адрес файла Excel на API.
 */
export function reportHref(filters: ReportFilters): string {
  return `${apiUrl('/api/v1/admin/reports/calls.xlsx')}?${reportQuery(filters).toString()}`;
}

/**
 * Объясняет отказ сборки отчёта словами.
 *
 * Ссылкой `<a download>` отказ не показать: браузер сохранил бы тело ошибки файлом или молча
 * написал «сбой». С расшифровкой (S-31) отказов стало больше: потолок — 50 000 звонков, и
 * одновременно собирается один отчёт.
 *
 * @param status Код ответа HTTP.
 * @param detail Причина отказа из ответа сервера.
 * @returns Текст для баннера.
 */
export function reportRefusalText(status: number, detail: string): string {
  if (detail === 'report_busy') return 'Отчёт уже собирается — повтори через минуту.';
  const tooLarge = /^report_too_large:\s*(\d+)\s*calls,\s*limit\s*(\d+)/.exec(detail);
  if (tooLarge) {
    return `За период ${tooLarge[1]} звонков, в отчёт помещается ${tooLarge[2]} — сузь период.`;
  }
  if (status === 401) return 'Сессия истекла. Обнови страницу, чтобы войти заново.';
  if (status === 403) return 'Недостаточно прав: отчёт доступен группе speech_admin.';
  return `Отчёт не собран: сервер ответил ${status}${detail ? ` (${detail})` : ''}.`;
}

/**
 * Выбирает имя файла отчёта: из `Content-Disposition`, а без него — собранное из периода и
 * источника.
 *
 * Запасное имя повторяет серверное (`speech-report-telphin-…` для Телфина):
 * два отчёта за один период с одинаковым именем перезапишут друг друга в
 * папке загрузок.
 *
 * @param disposition Значение заголовка; `null` — заголовка нет.
 * @param filters Фильтры формы: из них собирается запасное имя.
 * @returns Имя файла.
 */
export function reportFilename(disposition: string | null, filters: ReportFilters): string {
  const match = disposition ? /filename="?([^";]+)"?/.exec(disposition) : null;
  const prefix =
    filters.source === DEFAULT_SOURCE ? 'speech-report' : `speech-report-${filters.source}`;
  return match?.[1] ?? `${prefix}-${filters.from}_${filters.to}.xlsx`;
}

/**
 * Скачивает отчёт: кука сессии уходит с запросом.
 *
 * @param filters Фильтры формы.
 * @throws {Error} Сервер ответил отказом; текст ошибки показывается пользователю.
 */
export async function downloadReport(filters: ReportFilters): Promise<void> {
  const response = await fetch(reportHref(filters), { credentials: 'same-origin' });
  if (!response.ok) {
    let detail = '';
    try {
      detail = String(((await response.json()) as { detail?: unknown }).detail ?? '');
    } catch {
      detail = '';
    }
    throw new Error(reportRefusalText(response.status, detail));
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = reportFilename(response.headers.get('Content-Disposition'), filters);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Проверяет период отчёта до запроса, а не отказом сервера после нажатия.
 *
 * @param filters Фильтры формы.
 * @returns Что не так с периодом или `null`, если период годится.
 */
export function reportPeriodError(filters: ReportFilters): string | null {
  if (!filters.from || !filters.to) return 'Укажи обе даты периода.';
  if (filters.to < filters.from) return 'Конец периода раньше начала.';
  return null;
}
