'use client';

import { useQuery } from '@tanstack/react-query';
import type { CallSource } from '@/entities/call';
import type { Schemas } from '@/shared/api';
import { request } from '@/shared/api';

export type ClassificationResponse = Schemas['ClassificationResponse'];

/**
 * Загружает узлы классификатора периода для фильтров отчёта (SP-310) — только встречающиеся, со
 * счётом звонков по ветке у оператора и у ИИ.
 *
 * Список зависит от периода и источника (S-35), поэтому и ключ — от них: иначе
 * после смены дат или источника в списке остались бы чужие узлы с чужими
 * счётами.
 *
 * @param from Начало периода сутками.
 * @param to Конец периода сутками.
 * @param source Источник звонков.
 * @param enabled Отправлять ли запрос.
 * @returns Состояние запроса TanStack Query с узлами и счётом звонков по ним.
 */
export function useReportClassification(
  from: string,
  to: string,
  source: CallSource,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['admin', 'report-classification', from, to, source],
    queryFn: () =>
      request<ClassificationResponse>('/api/v1/admin/reports/classification', {
        query: { from, to, source },
      }),
    enabled,
  });
}
