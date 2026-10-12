import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@/shared/api';
import { request } from '@/shared/api';
import { ADMIN_PAGE_SIZE, adminKeys } from '@/widgets/admin-shell';

type AuditResponse = Schemas['AuditResponse'];

export type AuditFilters = {
  eventType: string;
  actorSub: string;
  callId: string;
  offset: number;
};

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  eventType: '',
  actorSub: '',
  callId: '',
  offset: 0,
};

/**
 * Загружает страницу журнала событий.
 *
 * @param filters Отбор по событию, учётной записи и звонку и смещение страницы.
 * @returns Состояние запроса TanStack Query со строками журнала.
 */
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
