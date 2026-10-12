import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@/shared/api';
import { request } from '@/shared/api';
import { adminKeys, useAdminMutation } from '@/widgets/admin-shell';

export type ClassifierNodeRow = Schemas['ClassifierNodeRow'];

export type ClassifierNodePatch = Schemas['ClassifierNodePatch'];

type ClassifierAdminResponse = Schemas['ClassifierAdminResponse'];

/**
 * Загружает классификатор обращений (SP-310): узлы плоским списком, дерево собирает экран.
 *
 * @returns Состояние запроса TanStack Query с узлами.
 */
export function useAdminClassifier() {
  return useQuery({
    queryKey: adminKeys.classifier,
    queryFn: () => request<ClassifierAdminResponse>('/api/v1/admin/classifier'),
  });
}

/**
 * Создаёт изменение узла классификатора: отключить или включить обратно.
 *
 * @returns Изменение TanStack Query; аргументы — идентификатор узла и правка.
 */
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
