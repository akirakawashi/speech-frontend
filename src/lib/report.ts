/**
 * Отчёт по звонкам в Excel (SP-604, пять уровней с SP-310): фильтры формы и
 * адрес выгрузки.
 *
 * Даты — календарные дни колл-центра, обе включительно. Границы суток ставит
 * сервер в своём поясе: считать их здесь значило бы считать в поясе браузера, а
 * он у каждого свой.
 */

import { apiUrl, type CallSource } from '@/api/client';
import { DEFAULT_SOURCE, isoDate } from '@/lib/search-params';

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
 * Параметры выгрузки: пустые фильтры не уходят, чтобы адрес читался.
 *
 * Источник пустым не бывает и уходит всегда, как и у выдачи: запрос сам
 * называет, чьи звонки он просит, а не полагается на умолчание сервера.
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

export function reportHref(filters: ReportFilters): string {
  return `${apiUrl('/api/v1/admin/reports/calls.xlsx')}?${reportQuery(filters).toString()}`;
}

/**
 * Отказ сервера словами. Ссылкой `<a download>` отказ не показать: браузер
 * сохранил бы тело ошибки файлом или молча написал «сбой». С расшифровкой
 * (S-31) отказов стало больше: потолок — 50 000 звонков, и одновременно
 * собирается один отчёт.
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
 * Имя файла из `Content-Disposition`; нет — собранное из периода и источника.
 *
 * Запасное имя повторяет серверное (`speech-report-telphin-…` для Телфина):
 * два отчёта за один период с одинаковым именем перезапишут друг друга в
 * папке загрузок.
 */
export function reportFilename(disposition: string | null, filters: ReportFilters): string {
  const match = disposition ? /filename="?([^";]+)"?/.exec(disposition) : null;
  const prefix =
    filters.source === DEFAULT_SOURCE ? 'speech-report' : `speech-report-${filters.source}`;
  return match?.[1] ?? `${prefix}-${filters.from}_${filters.to}.xlsx`;
}

/** Скачать отчёт: кука сессии уходит с запросом, отказ — исключением со словами. */
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

/** Что не так с периодом — до запроса, а не отказом сервера после нажатия. */
export function reportPeriodError(filters: ReportFilters): string | null {
  if (!filters.from || !filters.to) return 'Укажи обе даты периода.';
  if (filters.to < filters.from) return 'Конец периода раньше начала.';
  return null;
}
