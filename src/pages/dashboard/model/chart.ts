import type { DashboardResponse } from '../api/types';
import { OTHER_THEME } from './dashboard';

export const GRAIN_WORD = { day: 'дням', week: 'неделям', month: 'месяцам' } as const;

/**
 * Выбирает цвет темы по её месту в палитре; «Прочее» — нейтральный.
 *
 * @param key Ключ темы.
 * @param slots Места тем в палитре: ключ темы → номер места.
 * @returns Переменная CSS с цветом места.
 */
export function themeColor(key: string, slots: Map<string, number>): string {
  if (key === OTHER_THEME) return 'var(--series-other)';
  return `var(--series-${(slots.get(key) ?? 0) + 1})`;
}

/**
 * Проверяет, задевает ли период два календарных года.
 *
 * @param data Ответ дашборда с первым и последним днём периода.
 * @returns `true`, если год первого дня не совпадает с годом последнего.
 */
export function spansYears(data: DashboardResponse): boolean {
  return data.first_day.slice(0, 4) !== data.last_day.slice(0, 4);
}
