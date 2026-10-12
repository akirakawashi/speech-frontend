import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@/shared/api';
import { request } from '@/shared/api';
import type { ActionResponse } from '@/widgets/admin-shell';
import { ADMIN_PAGE_SIZE, adminKeys, useAdminMutation } from '@/widgets/admin-shell';

type JobsResponse = Schemas['JobsResponse'];

export type JobFilters = {
  status: string;
  kind: string;
  lane: string;
  offset: number;
};

export const EMPTY_JOB_FILTERS: JobFilters = { status: '', kind: '', lane: '', offset: 0 };

/**
 * Загружает страницу заданий конвейера.
 *
 * @param filters Отбор по состоянию, этапу и полосе и смещение страницы.
 * @returns Состояние запроса TanStack Query со строками заданий.
 */
export function useAdminJobs(filters: JobFilters) {
  return useQuery({
    queryKey: adminKeys.jobs(filters),
    queryFn: () =>
      request<JobsResponse>('/api/v1/admin/jobs', {
        query: {
          status: filters.status,
          kind: filters.kind,
          lane: filters.lane,
          limit: ADMIN_PAGE_SIZE,
          offset: filters.offset,
        },
      }),
  });
}

/**
 * Создаёт изменение «повторить задание».
 *
 * @returns Изменение TanStack Query; аргумент — идентификатор задания.
 */
export function useRetryJob() {
  return useAdminMutation(
    (jobId: string) =>
      request<ActionResponse>(`/api/v1/admin/jobs/${jobId}/retry`, { method: 'POST' }),
    [['admin', 'jobs'], adminKeys.pipeline],
  );
}

/**
 * Создаёт изменение «переобработать звонок с этапа».
 *
 * @returns Изменение TanStack Query; аргументы — идентификатор звонка и этап.
 */
export function useReprocessCall() {
  return useAdminMutation(
    ({ callId, from }: { callId: string; from: string }) =>
      request<ActionResponse>(`/api/v1/admin/calls/${callId}/reprocess`, {
        method: 'POST',
        query: { from },
      }),
    [['admin', 'jobs'], adminKeys.pipeline],
  );
}
