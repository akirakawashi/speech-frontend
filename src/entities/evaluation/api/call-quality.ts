import { useQuery } from '@tanstack/react-query';
import { request } from '@/shared/api';
import type { CallQualityResponse } from '../model/types';

/**
 * Загружает оценку звонка по скрипту.
 *
 * `404` значит «не оценён» — это состояние, а не поломка.
 *
 * @param callId Идентификатор звонка.
 * @param enabled Отправлять ли запрос.
 * @returns Состояние запроса TanStack Query с оценкой звонка.
 */
export function useCallQuality(callId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['call-quality', callId],
    queryFn: () => request<CallQualityResponse>(`/api/v1/calls/${callId}/quality`),
    enabled,
  });
}
