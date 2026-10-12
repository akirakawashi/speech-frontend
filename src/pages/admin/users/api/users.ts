import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@/shared/api';
import { request } from '@/shared/api';
import { adminKeys } from '@/widgets/admin-shell';

export type UserRow = Schemas['UserRow'];

type UsersResponse = Schemas['UsersResponse'];

/**
 * Загружает пользователей, которые заходили в систему.
 *
 * @returns Состояние запроса TanStack Query со списком пользователей.
 */
export function useAdminUsers() {
  return useQuery({
    queryKey: adminKeys.users,
    queryFn: () => request<UsersResponse>('/api/v1/admin/users'),
  });
}
