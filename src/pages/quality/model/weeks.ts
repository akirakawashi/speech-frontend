import type { Period } from '@/shared/lib/date';
import { shiftDay } from '@/shared/lib/date';
/**
 * Обрезает неделю столбца границами выбранного периода: с понедельника по воскресенье, но не шире
 * периода.
 *
 * Крайние столбцы периода неполные — сервер считает в них только звонки
 * периода. Клик по столбцу ставит период на ту же часть недели: возьми он
 * неделю целиком, число после клика разошлось бы с числом на столбце.
 *
 * @param weekStart Понедельник недели в виде `YYYY-MM-DD`.
 * @param within Выбранный период.
 * @returns Часть недели, попадающая в период.
 */
export function weekPeriod(weekStart: string, within: Period): Period {
  const end = shiftDay(weekStart, 6);
  return {
    from: weekStart < within.from ? within.from : weekStart,
    to: end > within.to ? within.to : end,
  };
}
