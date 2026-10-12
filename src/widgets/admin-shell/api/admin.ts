/**
 * Запросы администрирования (SP-506 поверх SP-601).
 *
 * Отдельно от запросов экранов намеренно. Пользовательские запросы читают, а
 * эти меняют состояние системы: каждое изменение здесь порождает событие журнала на
 * сервере, и путать эти два набора при чтении кода не стоит.
 *
 * Общий принцип инвалидации: после изменения перечитывается **и** изменённый
 * список, **и** журнал. Журнал — единственное место, где видно, что действие
 * дошло до сервера, а не осталось оптимистичной правкой на экране.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Schemas } from '@/shared/api';

export type ActionResponse = Schemas['ActionResponse'];

/** Сколько строк журнала и заданий показывается за раз. */
export const ADMIN_PAGE_SIZE = 50;

export const adminKeys = {
  classifier: ['admin', 'classifier'] as const,
  pipeline: ['admin', 'pipeline'] as const,
  jobs: (filters: object) => ['admin', 'jobs', filters] as const,
  projects: ['admin', 'projects'] as const,
  settings: ['admin', 'settings'] as const,
  audit: (filters: object) => ['admin', 'audit', filters] as const,
  users: ['admin', 'users'] as const,
};

/**
 * Создаёт изменение администрирования, после которого перечитываются данные и журнал.
 *
 * После изменения перечитывается изменённое **и журнал**.
 *
 * Журнал — не украшение экрана: он единственное свидетельство того, что
 * действие дошло до сервера. Оставив его устаревшим, мы бы показывали правку,
 * которой в журнале ещё нет, и разбор «применилось или нет» начинался бы с
 * обновления страницы вручную.
 *
 * @param mutationFn Запрос, который вносит изменение.
 * @param invalidate Ключи кэша, которые нужно перечитать после успеха.
 * @returns Изменение TanStack Query.
 */
export function useAdminMutation<TArgs, TResult>(
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
