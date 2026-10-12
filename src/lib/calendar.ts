/**
 * Календарь выбора суток: сетка месяца и переход между месяцами.
 *
 * Сутки и месяцы — строки `YYYY-MM-DD` и `YYYY-MM`, арифметика — в UTC. Через
 * местное время та же сетка съезжала бы на день у всякого, кто западнее
 * Гринвича: `toISOString` возвращает сутки UTC, а не местные.
 */

const DAY_MS = 86_400_000;

/** Дни недели в шапке календаря. Неделя начинается с понедельника. */
export const WEEKDAYS: readonly string[] = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const MONTHS: readonly string[] = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

/** Месяц суток: `2026-09-14` → `2026-09`. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/**
 * Сетка месяца: шесть недель с понедельника, 42 суток подряд. Шесть — всегда:
 * календарь не должен менять высоту от месяца к месяцу.
 */
export function monthGrid(month: string): string[] {
  const first = new Date(`${month}-01T00:00:00Z`);
  // `getUTCDay`: воскресенье — 0. Сдвиг делает первым понедельник.
  const lead = (first.getUTCDay() + 6) % 7;
  const start = first.getTime() - lead * DAY_MS;
  return Array.from({ length: 42 }, (_, index) =>
    new Date(start + index * DAY_MS).toISOString().slice(0, 10),
  );
}

export function shiftMonth(month: string, delta: number): string {
  const moment = new Date(`${month}-01T00:00:00Z`);
  moment.setUTCMonth(moment.getUTCMonth() + delta);
  return moment.toISOString().slice(0, 7);
}

/** Подпись месяца: `сентябрь 2026`. */
export function monthLabel(month: string): string {
  const [year, index] = month.split('-');
  return `${MONTHS[Number(index) - 1] ?? month} ${year}`;
}
