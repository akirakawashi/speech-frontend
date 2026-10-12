'use client';

import { useQuery } from '@tanstack/react-query';
import { type CallSource, request } from '@/api/client';
import type { components } from '@/api/schema';

export type ClassificationResponse = components['schemas']['ClassificationResponse'];
export type ClassificationNode = components['schemas']['ClassificationNode'];

/**
 * Узлы классификатора периода для фильтров отчёта (SP-310) — только
 * встречающиеся, со счётом звонков по ветке у оператора и у ИИ.
 *
 * Список зависит от периода и источника (S-35), поэтому и ключ — от них: иначе
 * после смены дат или источника в списке остались бы чужие узлы с чужими
 * счётами.
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
