'use client';

import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type {
  CallQualityResponse,
  CallResponse,
  CallSource,
  ClassifierResponse,
  DashboardResponse,
  OptionsResponse,
  QualityCallsResponse,
  QualitySummaryResponse,
  SearchResponse,
  StatsResponse,
} from '@/api/client';
import { request } from '@/api/client';
import type { SearchState } from '@/lib/search-params';
import { statsQuery, toApiQuery } from '@/lib/search-params';

/** Размер страницы выдачи (SRC-05). Совпадает с умолчанием сервера. */
export const PAGE_SIZE = 20;

/**
 * Ключ собирается из состояния экрана целиком, за вычетом номера страницы —
 * страницы копит сам запрос.
 *
 * Не из «важных» полей: стоит забыть одно, и смена фильтра покажет чужую
 * выдачу из кэша, а выглядеть это будет как «поиск иногда врёт».
 */
export function searchKey(state: SearchState) {
  const { page: _page, ...rest } = toApiQuery(state);
  return ['search', rest] as const;
}

/**
 * «Показать ещё» **дописывает** страницу, а не заменяет список (SRC-05).
 *
 * Обычный постраничный запрос отдал бы двадцать следующих карточек вместо
 * сорока, и счётчик «Показано X из M» врал бы при первом же нажатии. Номер
 * последней загруженной страницы живёт в адресе, поэтому ссылка восстанавливает
 * не только запрос, но и то, сколько человек успел пролистать.
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

export function useStats(state: SearchState) {
  // Период и источник у KPI те же, что у выдачи, включая «за всё время»:
  // счётчики, показывающие ноль над непустым списком, читаются как поломка.
  const query = statsQuery(state);
  return useQuery({
    queryKey: ['stats', query],
    queryFn: () => request<StatsResponse>('/api/v1/stats', { query }),
  });
}

/** Справочники фильтров. Меняются раз в сутки — переспрашивать их незачем. */
const DIRECTORY_STALE_MS = 10 * 60 * 1000;

/**
 * Справочники — по источнику (S-35): у NCC и Телфина разные операторы и
 * очереди. Ключ начинается с прежнего `['operators']` / `['projects']`, и
 * синхронизация справочников в админке перечитывает обе вкладки разом.
 */
export function useOperators(source: CallSource) {
  return useQuery({
    queryKey: ['operators', source],
    queryFn: () => request<OptionsResponse>('/api/v1/operators', { query: { source } }),
    staleTime: DIRECTORY_STALE_MS,
  });
}

export function useProjects(source: CallSource) {
  return useQuery({
    queryKey: ['projects', source],
    queryFn: () => request<OptionsResponse>('/api/v1/projects', { query: { source } }),
    staleTime: DIRECTORY_STALE_MS,
  });
}

/**
 * Дерево классификатора для фильтра «Классификация» (SP-310) — плоско; выбор по
 * уровням собирает `pickerLevels`. Ключ тот же, что перечитывает админка после
 * выключения узла.
 */
export function useClassifier() {
  return useQuery({
    queryKey: ['classifier'],
    queryFn: () => request<ClassifierResponse>('/api/v1/classifier'),
    staleTime: DIRECTORY_STALE_MS,
  });
}

type QualityQuery = Record<string, string | boolean | undefined>;

/** Страница списка оценённых звонков. Совпадает с умолчанием сервера. */
export const QUALITY_CALLS_PAGE = 50;

/**
 * Сводка оценок за период. Ключ — параметры целиком: период, сотрудник и
 * «без оператора» вместе, иначе смена сотрудника показала бы чужую сводку из кэша.
 */
export function useQualitySummary(query: QualityQuery, enabled = true) {
  return useQuery({
    queryKey: ['quality-summary', query],
    queryFn: () => request<QualitySummaryResponse>('/api/v1/quality/summary', { query }),
    enabled,
  });
}

/**
 * Оценённые звонки с отбором и порядком. «Показать ещё» дописывает страницу,
 * как у выдачи диалогов: смещение — число уже загруженных строк.
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

/**
 * Карточка звонка без поискового запроса. Ключ тот же, что у панели диалогов с
 * пустым запросом: открытый там звонок здесь уже загружен, и наоборот.
 */
export function useCall(callId: string) {
  return useQuery({
    queryKey: ['call', callId, ''],
    queryFn: () => request<CallResponse>(`/api/v1/calls/${callId}`),
  });
}

/** Оценка звонка. `404` значит «не оценён» — это состояние, а не поломка. */
export function useCallQuality(callId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['call-quality', callId],
    queryFn: () => request<CallQualityResponse>(`/api/v1/calls/${callId}/quality`),
    enabled,
  });
}

type DashboardQuery = Record<string, string | undefined>;

/**
 * Дашборд: обращения по темам за период.
 *
 * Пока идёт новый запрос, на экране остаётся прежний ответ: смена темы или
 * корзины перерисовывает числа на месте, а не сворачивает страницу до
 * «Загружаем…» и обратно.
 */
export function useDashboard(query: DashboardQuery) {
  return useQuery({
    queryKey: ['dashboard', query],
    queryFn: () => request<DashboardResponse>('/api/v1/dashboard', { query }),
    placeholderData: keepPreviousData,
  });
}
