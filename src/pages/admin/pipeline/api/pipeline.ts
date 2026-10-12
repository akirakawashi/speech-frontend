import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@/shared/api';
import { request } from '@/shared/api';
import type { ActionResponse } from '@/widgets/admin-shell';
import { adminKeys, useAdminMutation } from '@/widgets/admin-shell';

export type LaneRow = Schemas['LaneRow'];

export type DependencyRow = Schemas['DependencyRow'];

export type PipelineResponse = Schemas['PipelineResponse'];

/**
 * Снимок пайплайна переспрашивается сам.
 *
 * Это единственный экран, который смотрят **во время** происшествия: очередь
 * растёт, зависимость отвалилась. Статичное число на нём означало бы, что
 * человек обновляет страницу вручную и не знает, устарела ли она.
 */
const PIPELINE_REFETCH_MS = 15_000;

/**
 * Загружает снимок конвейера и переспрашивает его каждые пятнадцать секунд.
 *
 * @returns Состояние запроса TanStack Query со снимком.
 */
export function useAdminPipeline() {
  return useQuery({
    queryKey: adminKeys.pipeline,
    queryFn: () => request<PipelineResponse>('/api/v1/admin/pipeline'),
    refetchInterval: PIPELINE_REFETCH_MS,
  });
}

/**
 * Создаёт изменение «запустить или приостановить разбор истории».
 *
 * @returns Изменение TanStack Query; аргумент — `start` или `pause`.
 */
export function useBackfill() {
  return useAdminMutation(
    (action: 'start' | 'pause') =>
      request<ActionResponse>(`/api/v1/admin/backfill/${action}`, { method: 'POST' }),
    [adminKeys.pipeline, ['admin', 'jobs']],
  );
}
