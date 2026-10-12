import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@/shared/api';
import { request } from '@/shared/api';
import type { ActionResponse } from '@/widgets/admin-shell';
import { adminKeys, useAdminMutation } from '@/widgets/admin-shell';

export type ProjectRow = Schemas['ProjectRow'];

export type ProjectPatch = Schemas['ProjectPatch'];

type ProjectsAdminResponse = Schemas['ProjectsAdminResponse'];

/**
 * Загружает проекты звонков с их разметкой.
 *
 * @returns Состояние запроса TanStack Query со списком проектов.
 */
export function useAdminProjects() {
  return useQuery({
    queryKey: adminKeys.projects,
    queryFn: () => request<ProjectsAdminResponse>('/api/v1/admin/projects'),
  });
}

/**
 * Создаёт изменение проекта: сегмент, продукт или приём звонков.
 *
 * @returns Изменение TanStack Query; аргументы — идентификатор проекта и правка.
 */
export function useUpdateProject() {
  return useAdminMutation(
    ({ id, patch }: { id: string; patch: ProjectPatch }) =>
      request<ProjectRow>(`/api/v1/admin/projects/${id}`, { method: 'PATCH', body: patch }),
    [adminKeys.projects, ['projects']],
  );
}

/**
 * Создаёт изменение «подтянуть справочники из NCC».
 *
 * Перечитывается не только список проектов, но и операторы: одна ручка сервиса
 * обновляет оба справочника, и показывать это двумя кнопками значило бы
 * требовать от администратора знать, какой из них откуда берётся.
 *
 * @returns Изменение TanStack Query без аргументов.
 */
export function useSyncDirectories() {
  return useAdminMutation(
    () => request<ActionResponse>('/api/v1/admin/projects/sync', { method: 'POST' }),
    [adminKeys.projects, ['projects'], ['operators']],
  );
}
