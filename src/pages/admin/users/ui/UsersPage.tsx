'use client';

import { formatDateTime } from '@/shared/lib/format';
import { AsyncTable, adminStyles, Screen } from '@/widgets/admin-shell';
import { useAdminUsers } from '../api/users';

/**
 * Экран «Пользователи»: кто заходил и с какими ролями.
 *
 * @returns Таблица пользователей.
 */
export function UsersPage() {
  const users = useAdminUsers();
  const items = users.data?.items ?? [];

  return (
    <Screen
      title="Пользователи"
      hint="Список тех, кто заходил. Права выдаются группами в Keycloak, а не здесь: вторая точка управления доступом рядом с настоящей расходится с ней молча — и разбирать «почему у него нет доступа» приходится в двух местах вместо одного."
    >
      <AsyncTable
        isLoading={users.isLoading}
        error={users.error}
        isEmpty={items.length === 0}
        emptyText="Никто ещё не заходил."
      >
        <table className={adminStyles.table}>
          <thead>
            <tr>
              <th>Кто</th>
              <th>Почта</th>
              <th>Роли при последнем входе</th>
              <th>Впервые</th>
              <th>Последний раз</th>
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
              <tr key={user.sub}>
                <td>
                  {user.display_name ?? user.username ?? '—'}
                  <div className={adminStyles.mono}>{user.sub}</div>
                </td>
                <td>{user.email ?? '—'}</td>
                <td className={adminStyles.mono}>
                  {(user.roles_last_seen ?? []).join(', ') || '—'}
                </td>
                <td className={adminStyles.mono}>{formatDateTime(user.first_seen_at)}</td>
                <td className={adminStyles.mono}>{formatDateTime(user.last_seen_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncTable>
    </Screen>
  );
}
