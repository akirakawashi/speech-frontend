'use client';

import { useQuery } from '@tanstack/react-query';
import { request } from '@/shared/api';
import type { CallResponse } from '../model/types';

/**
 * Загружает карточку звонка.
 *
 * Ключ кэша — звонок и поисковый запрос: с запросом сервер отмечает в карточке
 * совпадения. Карточка без запроса одна на все экраны: открытый в «Диалогах»
 * звонок в разборе оценки уже загружен, и наоборот.
 *
 * @param callId Идентификатор звонка.
 * @param query Поисковый запрос, совпадения с которым надо отметить в репликах; пустой — без отметок.
 * @returns Состояние запроса TanStack Query с карточкой звонка.
 */
export function useCall(callId: string, query = '') {
  return useQuery({
    queryKey: ['call', callId, query],
    queryFn: () =>
      request<CallResponse>(`/api/v1/calls/${callId}`, { query: { q: query || undefined } }),
  });
}
