import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { request } from '@/shared/api';
import { type SearchState, statsQuery, toApiQuery } from '../model/search-state';
import type { SearchResponse, StatsResponse } from '../model/types';

/** Размер страницы выдачи (SRC-05). Совпадает с умолчанием сервера. */
export const PAGE_SIZE = 20;

/**
 * Строит ключ кэша выдачи поиска.
 *
 * Ключ собирается из состояния экрана целиком, за вычетом номера страницы —
 * страницы копит сам запрос.
 *
 * Не из «важных» полей: стоит забыть одно, и смена фильтра покажет чужую
 * выдачу из кэша, а выглядеть это будет как «поиск иногда врёт».
 *
 * @param state Состояние поиска.
 * @returns Ключ из параметров запроса без номера страницы.
 */
export function searchKey(state: SearchState) {
  const { page: _page, ...rest } = toApiQuery(state);
  return ['search', rest] as const;
}

/**
 * Загружает выдачу поиска страницами.
 *
 * «Показать ещё» **дописывает** страницу, а не заменяет список (SRC-05).
 *
 * Обычный постраничный запрос отдал бы двадцать следующих карточек вместо
 * сорока, и счётчик «Показано X из M» врал бы при первом же нажатии. Номер
 * последней загруженной страницы живёт в адресе, поэтому ссылка восстанавливает
 * не только запрос, но и то, сколько человек успел пролистать.
 *
 * @param state Состояние поиска.
 * @param enabled Отправлять ли запрос.
 * @returns Состояние запроса TanStack Query с загруженными страницами выдачи.
 */
export function useSearch(state: SearchState, enabled = true) {
  return useInfiniteQuery({
    queryKey: searchKey(state),
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      request<SearchResponse>('/api/v1/search', {
        query: { ...toApiQuery(state), page: pageParam },
      }),
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((sum, page) => sum + (page.items?.length ?? 0), 0);
      return loaded < last.total_calls ? all.length + 1 : undefined;
    },
  });
}

/**
 * Загружает счёты периода и главные темы над выдачей.
 *
 * @param state Состояние поиска: из него берутся период и источник.
 * @returns Состояние запроса TanStack Query со счётами периода.
 */
export function useStats(state: SearchState) {
  // Период и источник у KPI те же, что у выдачи, включая «за всё время»:
  // счётчики, показывающие ноль над непустым списком, читаются как поломка.
  const query = statsQuery(state);
  return useQuery({
    queryKey: ['stats', query],
    queryFn: () => request<StatsResponse>('/api/v1/stats', { query }),
  });
}
