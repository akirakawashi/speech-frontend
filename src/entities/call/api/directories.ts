import { useQuery } from '@tanstack/react-query';
import { DIRECTORY_STALE_MS, request } from '@/shared/api';
import type { CallSource, OptionsResponse } from '../model/types';

/**
 * Загружает операторов источника для фильтра.
 *
 * Справочники — по источнику (S-35): у NCC и Телфина разные операторы и
 * очереди. Ключ начинается с прежнего `['operators']` / `['projects']`, и
 * синхронизация справочников в админке перечитывает обе вкладки разом.
 *
 * @param source Источник звонков.
 * @returns Состояние запроса TanStack Query со списком операторов.
 */
export function useOperators(source: CallSource) {
  return useQuery({
    queryKey: ['operators', source],
    queryFn: () => request<OptionsResponse>('/api/v1/operators', { query: { source } }),
    staleTime: DIRECTORY_STALE_MS,
  });
}

/**
 * Загружает проекты источника для фильтра.
 *
 * @param source Источник звонков.
 * @returns Состояние запроса TanStack Query со списком проектов.
 */
export function useProjects(source: CallSource) {
  return useQuery({
    queryKey: ['projects', source],
    queryFn: () => request<OptionsResponse>('/api/v1/projects', { query: { source } }),
    staleTime: DIRECTORY_STALE_MS,
  });
}
