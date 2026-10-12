'use client';

/**
 * Запросы администрирования (SP-506 поверх SP-601).
 *
 * Отдельно от `queries.ts` намеренно. Пользовательские запросы читают, а эти
 * меняют состояние системы: каждое изменение здесь порождает событие журнала на
 * сервере, и путать эти два набора при чтении кода не стоит.
 *
 * Общий принцип инвалидации: после изменения перечитывается **и** изменённый
 * список, **и** журнал. Журнал — единственное место, где видно, что действие
 * дошло до сервера, а не осталось оптимистичной правкой на экране.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/client';
import type { components } from '@/api/schema';

type Schemas = components['schemas'];

export type ClassifierNodeRow = Schemas['ClassifierNodeRow'];
export type ClassifierNodePatch = Schemas['ClassifierNodePatch'];
export type JobRow = Schemas['JobRow'];
export type LaneRow = Schemas['LaneRow'];
export type DependencyRow = Schemas['DependencyRow'];
export type PipelineResponse = Schemas['PipelineResponse'];
export type ProjectRow = Schemas['ProjectRow'];
export type ProjectPatch = Schemas['ProjectPatch'];
export type SettingsResponse = Schemas['SettingsResponse'];
export type AuditRow = Schemas['AuditRow'];
export type UserRow = Schemas['UserRow'];
export type ActionResponse = Schemas['ActionResponse'];

type ClassifierAdminResponse = Schemas['ClassifierAdminResponse'];
type JobsResponse = Schemas['JobsResponse'];
type ProjectsAdminResponse = Schemas['ProjectsAdminResponse'];
type AuditResponse = Schemas['AuditResponse'];
type UsersResponse = Schemas['UsersResponse'];

/** Сколько строк журнала и заданий показывается за раз. */
export const ADMIN_PAGE_SIZE = 50;

/**
 * Снимок пайплайна переспрашивается сам.
 *
 * Это единственный экран, который смотрят **во время** происшествия: очередь
 * растёт, зависимость отвалилась. Статичное число на нём означало бы, что
 * человек обновляет страницу вручную и не знает, устарела ли она.
 */
const PIPELINE_REFETCH_MS = 15_000;

export const adminKeys = {
  classifier: ['admin', 'classifier'] as const,
  pipeline: ['admin', 'pipeline'] as const,
  jobs: (filters: JobFilters) => ['admin', 'jobs', filters] as const,
  projects: ['admin', 'projects'] as const,
  settings: ['admin', 'settings'] as const,
  audit: (filters: AuditFilters) => ['admin', 'audit', filters] as const,
  users: ['admin', 'users'] as const,
};

export type JobFilters = {
  status: string;
  kind: string;
  lane: string;
  offset: number;
};

export type AuditFilters = {
  eventType: string;
  actorSub: string;
  callId: string;
  offset: number;
};

export const EMPTY_JOB_FILTERS: JobFilters = { status: '', kind: '', lane: '', offset: 0 };
export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  eventType: '',
  actorSub: '',
  callId: '',
  offset: 0,
};

// --------------------------------------------------------------------------- //
// Чтение
// --------------------------------------------------------------------------- //

/** Классификатор обращений (SP-310): узлы плоским списком, дерево собирает экран. */
export function useAdminClassifier() {
  return useQuery({
    queryKey: adminKeys.classifier,
    queryFn: () => request<ClassifierAdminResponse>('/api/v1/admin/classifier'),
  });
}

export function useAdminPipeline() {
  return useQuery({
    queryKey: adminKeys.pipeline,
    queryFn: () => request<PipelineResponse>('/api/v1/admin/pipeline'),
    refetchInterval: PIPELINE_REFETCH_MS,
  });
}

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

export function useAdminProjects() {
  return useQuery({
    queryKey: adminKeys.projects,
    queryFn: () => request<ProjectsAdminResponse>('/api/v1/admin/projects'),
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: adminKeys.settings,
    queryFn: () => request<SettingsResponse>('/api/v1/admin/settings'),
  });
}

export function useAdminAudit(filters: AuditFilters) {
  return useQuery({
    queryKey: adminKeys.audit(filters),
    queryFn: () =>
      request<AuditResponse>('/api/v1/admin/audit', {
        query: {
          event_type: filters.eventType,
          actor_sub: filters.actorSub,
          call_id: filters.callId,
          limit: ADMIN_PAGE_SIZE,
          offset: filters.offset,
        },
      }),
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: adminKeys.users,
    queryFn: () => request<UsersResponse>('/api/v1/admin/users'),
  });
}

// --------------------------------------------------------------------------- //
// Изменения
// --------------------------------------------------------------------------- //

/**
 * После изменения перечитывается изменённое **и журнал**.
 *
 * Журнал — не украшение экрана: он единственное свидетельство того, что
 * действие дошло до сервера. Оставив его устаревшим, мы бы показывали правку,
 * которой в журнале ещё нет, и разбор «применилось или нет» начинался бы с
 * обновления страницы вручную.
 */
function useAdminMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  invalidate: readonly (readonly unknown[])[],
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        ...invalidate.map((key) => client.invalidateQueries({ queryKey: key })),
        client.invalidateQueries({ queryKey: ['admin', 'audit'] }),
      ]);
    },
  });
}

/** Отключить узел классификатора или включить обратно. */
export function useUpdateClassifierNode() {
  return useAdminMutation(
    ({ id, patch }: { id: string; patch: ClassifierNodePatch }) =>
      request<ClassifierNodeRow>(`/api/v1/admin/classifier/${id}`, {
        method: 'PATCH',
        body: patch,
      }),
    [adminKeys.classifier, ['classifier']],
  );
}

export function useUpdateProject() {
  return useAdminMutation(
    ({ id, patch }: { id: string; patch: ProjectPatch }) =>
      request<ProjectRow>(`/api/v1/admin/projects/${id}`, { method: 'PATCH', body: patch }),
    [adminKeys.projects, ['projects']],
  );
}

export function useSaveSettings() {
  return useAdminMutation(
    (values: Record<string, unknown>) =>
      request<ActionResponse>('/api/v1/admin/settings', { method: 'PUT', body: { values } }),
    [adminKeys.settings],
  );
}

export function useRetryJob() {
  return useAdminMutation(
    (jobId: string) =>
      request<ActionResponse>(`/api/v1/admin/jobs/${jobId}/retry`, { method: 'POST' }),
    [['admin', 'jobs'], adminKeys.pipeline],
  );
}

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

/**
 * Подтянуть справочники из NCC.
 *
 * Перечитывается не только список проектов, но и операторы: одна ручка сервиса
 * обновляет оба справочника, и показывать это двумя кнопками значило бы
 * требовать от администратора знать, какой из них откуда берётся.
 */
export function useSyncDirectories() {
  return useAdminMutation(
    () => request<ActionResponse>('/api/v1/admin/projects/sync', { method: 'POST' }),
    [adminKeys.projects, ['projects'], ['operators']],
  );
}

export function useBackfill() {
  return useAdminMutation(
    (action: 'start' | 'pause') =>
      request<ActionResponse>(`/api/v1/admin/backfill/${action}`, { method: 'POST' }),
    [adminKeys.pipeline, ['admin', 'jobs']],
  );
}
