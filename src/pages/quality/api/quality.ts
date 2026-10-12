import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { request } from '@/shared/api';
import type { QualityCallsResponse, QualitySummaryResponse } from './types';

type QualityQuery = Record<string, string | boolean | undefined>;

/** Страница списка оценённых звонков. Совпадает с умолчанием сервера. */
export const QUALITY_CALLS_PAGE = 50;

/**
 * Загружает сводку оценок за период.
 *
 * Ключ — параметры целиком: период, сотрудник и «без оператора» вместе, иначе смена сотрудника
 * показала бы чужую сводку из кэша.
 *
 * @param query Параметры охвата: период, сотрудник или звонки без оператора.
 * @param enabled Отправлять ли запрос.
 * @returns Состояние запроса TanStack Query со сводкой.
 */
export function useQualitySummary(query: QualityQuery, enabled = true) {
  return useQuery({
    queryKey: ['quality-summary', query],
    queryFn: () => request<QualitySummaryResponse>('/api/v1/quality/summary', { query }),
    enabled,
  });
}

/**
 * Загружает оценённые звонки страницами, с отбором и порядком.
 *
 * «Показать ещё» дописывает страницу, как у выдачи диалогов: смещение — число уже загруженных
 * строк.
 *
 * @param query Параметры охвата, отбора и порядка.
 * @param enabled Отправлять ли запрос.
 * @returns Состояние запроса TanStack Query с загруженными страницами списка.
 */
export function useQualityCalls(query: QualityQuery, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['quality-calls', query],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      request<QualityCallsResponse>('/api/v1/quality/calls', {
        query: { ...query, limit: QUALITY_CALLS_PAGE, offset: pageParam },
      }),
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((sum, page) => sum + (page.items?.length ?? 0), 0);
      return loaded < last.total ? loaded : undefined;
    },
    enabled,
  });
}
