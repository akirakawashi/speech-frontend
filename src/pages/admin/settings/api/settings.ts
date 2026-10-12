import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@/shared/api';
import { request } from '@/shared/api';
import type { ActionResponse } from '@/widgets/admin-shell';
import { adminKeys, useAdminMutation } from '@/widgets/admin-shell';

export type SettingsResponse = Schemas['SettingsResponse'];

/**
 * Загружает настройки системы и список заданных администратором.
 *
 * @returns Состояние запроса TanStack Query с настройками.
 */
export function useAdminSettings() {
  return useQuery({
    queryKey: adminKeys.settings,
    queryFn: () => request<SettingsResponse>('/api/v1/admin/settings'),
  });
}

/**
 * Создаёт изменение настроек.
 *
 * @returns Изменение TanStack Query; аргумент — набор изменённых значений.
 */
export function useSaveSettings() {
  return useAdminMutation(
    (values: Record<string, unknown>) =>
      request<ActionResponse>('/api/v1/admin/settings', { method: 'PUT', body: { values } }),
    [adminKeys.settings],
  );
}
