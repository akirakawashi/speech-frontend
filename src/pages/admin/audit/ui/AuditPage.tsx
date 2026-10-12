'use client';

import { useState } from 'react';
import { formatDateTime } from '@/shared/lib/format';
import { ADMIN_PAGE_SIZE, AsyncTable, adminStyles, Field, Screen } from '@/widgets/admin-shell';
import { type AuditFilters, EMPTY_AUDIT_FILTERS, useAdminAudit } from '../api/audit';
import { AUDIT_EVENT_LABEL } from '../model/events';
import styles from './AuditPage.module.css';

const EVENT_TYPES = Object.keys(AUDIT_EVENT_LABEL);

/**
 * Записывает полезную нагрузку события текстом, как есть.
 *
 * Разбирать её на поля значило бы решать за читателя, что в ней важно, — а
 * важно там ровно то, чего не хватило при разборе конкретного случая. Формат
 * читаемый, но не переписанный.
 *
 * @param payload Полезная нагрузка события журнала.
 * @returns По строке на поле; прочерк, если нагрузки нет.
 */
function payloadText(payload: unknown): string {
  if (payload === null || payload === undefined) return '—';
  if (typeof payload !== 'object') return String(payload);
  const entries = Object.entries(payload as Record<string, unknown>);
  if (entries.length === 0) return '—';
  return entries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n');
}

/**
 * Экран «Журнал»: события изменения системы и обращения к скрытым данным.
 *
 * @returns Фильтры и таблица событий с листанием.
 */
export function AuditPage() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const audit = useAdminAudit(filters);

  const items = audit.data?.items ?? [];
  const total = audit.data?.total ?? 0;
  const shown = filters.offset + items.length;

  /**
   * Меняет фильтр журнала и возвращает на первую страницу.
   *
   * @param patch Изменённые поля фильтра.
   */
  const set = (patch: Partial<AuditFilters>) =>
    setFilters((previous) => ({ ...previous, offset: 0, ...patch }));

  return (
    <Screen
      title="Журнал"
      hint="Каждое изменение состояния системы и каждое обращение к скрытым данным попадает сюда. Журнал только читается: запись, которую можно отредактировать, свидетельством не является."
    >
      <div className={adminStyles.filters}>
        <Field id="audit-event" label="Событие" width={220}>
          <select
            id="audit-event"
            className={adminStyles.control}
            value={filters.eventType}
            onChange={(event) => set({ eventType: event.target.value })}
          >
            <option value="">любое</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {AUDIT_EVENT_LABEL[type]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="audit-actor" label="Учётная запись" width={220}>
          <input
            id="audit-actor"
            className={adminStyles.control}
            value={filters.actorSub}
            onChange={(event) => set({ actorSub: event.target.value })}
            placeholder="sub из токена"
          />
        </Field>

        <Field id="audit-call" label="Звонок" width={300}>
          <input
            id="audit-call"
            className={adminStyles.control}
            value={filters.callId}
            onChange={(event) => set({ callId: event.target.value })}
            placeholder="идентификатор звонка"
          />
        </Field>

        <button
          type="button"
          className={adminStyles.ghost}
          onClick={() => setFilters(EMPTY_AUDIT_FILTERS)}
        >
          Сбросить
        </button>
      </div>

      <AsyncTable
        isLoading={audit.isLoading}
        error={audit.error}
        isEmpty={items.length === 0}
        emptyText="Событий с такими признаками нет."
      >
        <table className={adminStyles.table}>
          <thead>
            <tr>
              <th>Когда</th>
              <th>Событие</th>
              <th>Кто</th>
              <th>Звонок</th>
              <th>Подробности</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td className={adminStyles.mono}>{formatDateTime(row.occurred_at)}</td>
                <td>{AUDIT_EVENT_LABEL[row.event_type] ?? row.event_type}</td>
                <td>
                  {row.actor_name ?? row.actor_sub}
                  <div className={adminStyles.mono}>
                    {(row.actor_roles ?? []).join(', ') || '—'}
                  </div>
                </td>
                <td className={adminStyles.mono}>{row.call_id ?? '—'}</td>
                <td>
                  <pre className={styles.payload}>{payloadText(row.payload)}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncTable>

      {total > 0 ? (
        <div className={adminStyles.rowActions}>
          <span className={adminStyles.hint}>
            Показано {shown} из {total}
          </span>
          <button
            type="button"
            className={adminStyles.ghost}
            disabled={filters.offset === 0}
            onClick={() =>
              setFilters((p) => ({ ...p, offset: Math.max(0, p.offset - ADMIN_PAGE_SIZE) }))
            }
          >
            ← назад
          </button>
          <button
            type="button"
            className={adminStyles.ghost}
            disabled={shown >= total}
            onClick={() => setFilters((p) => ({ ...p, offset: p.offset + ADMIN_PAGE_SIZE }))}
          >
            вперёд →
          </button>
        </div>
      ) : null}
    </Screen>
  );
}
