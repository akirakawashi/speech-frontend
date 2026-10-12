import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { request } from '@/shared/api';
import type { DashboardResponse } from './types';

type DashboardQuery = Record<string, string | undefined>;

/**
 * Загружает дашборд: обращения по темам за период.
 *
 * Пока идёт новый запрос, на экране остаётся прежний ответ: смена темы или
 * корзины перерисовывает числа на месте, а не сворачивает страницу до
 * «Загружаем…» и обратно.
 *
 * @param query Параметры запроса: границы периода, корзина и выбранная тема.
 * @returns Состояние запроса TanStack Query; пока идёт новый запрос, в нём остаётся прежний ответ.
 */
export function useDashboard(query: DashboardQuery) {
  return useQuery({
    queryKey: ['dashboard', query],
    queryFn: () => request<DashboardResponse>('/api/v1/dashboard', { query }),
    placeholderData: keepPreviousData,
  });
}
