import { isoDate } from './date';
/** Сколько дней показывает период по умолчанию (SRC-02). */
export const DEFAULT_PERIOD_DAYS = 30;

/**
 * Строит период по умолчанию: последние тридцать дней.
 *
 * Период по умолчанию считается и здесь, и на сервере, и это осознанное
 * дублирование: сервер обязан иметь умолчание, иначе запрос без параметров
 * пройдёт по всему архиву; интерфейс обязан показать человеку, какой период он
 * смотрит, а не пустые поля. Значение одно — 30 дней, и оно названо константой
 * с обеих сторон.
 *
 * @param now Текущий момент.
 * @returns Границы периода сутками `YYYY-MM-DD`.
 */
export function defaultPeriod(now: Date): { from: string; to: string } {
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - DEFAULT_PERIOD_DAYS);
  return { from: isoDate(from), to: isoDate(now) };
}

/**
 * Записывает сутки `YYYY-MM-DD` как `ДД.ММ.ГГГГ` — без перевода через `Date`.
 *
 * Неделя и границы периода — это сутки, а не момент: переведённые через пояс, они съезжали бы на
 * предыдущий день у всякого, кто западнее Гринвича.
 *
 * @param value Сутки в виде `YYYY-MM-DD`.
 * @returns Сутки в виде `ДД.ММ.ГГГГ`; исходная строка, если она не похожа на дату.
 */
export function formatDay(value: string): string {
  const [year, month, date] = value.split('-');
  return year && month && date ? `${date}.${month}.${year}` : value;
}

export type Period = { from: string; to: string };

/**
 * Сдвигает сутки на заданное число дней.
 *
 * @param day Сутки в виде `YYYY-MM-DD`.
 * @param days На сколько дней сдвинуть; отрицательное число — назад.
 * @returns Сутки в том же виде.
 */
export function shiftDay(day: string, days: number): string {
  const moment = new Date(`${day}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
}

/**
 * Переставляет одну границу периода по выбору в календаре.
 *
 * Период не переворачивается: если начало выбрано позже конца, конец встаёт на ту же дату, и
 * наоборот — правило макета.
 *
 * @param period Период до правки.
 * @param edge Какая граница меняется: начало (`from`) или конец (`to`).
 * @param day Новые сутки этой границы.
 * @returns Новый период; вторая граница подтянута, если иначе период перевернулся бы.
 */
export function movePeriod(period: Period, edge: 'from' | 'to', day: string): Period {
  if (edge === 'from') return { from: day, to: day > period.to ? day : period.to };
  return { from: day < period.from ? day : period.from, to: day };
}

/**
 * Подписывает период коротко, без года: `14.09–20.09`, одни сутки — `14.09`.
 *
 * @param period Период.
 * @returns `ДД.ММ–ДД.ММ`; одни сутки — `ДД.ММ`.
 */
export function periodLabel(period: Period): string {
  const from = formatDay(period.from).slice(0, 5);
  const to = formatDay(period.to).slice(0, 5);
  return from === to ? from : `${from}–${to}`;
}

/**
 * Находит предыдущий период той же длины, вплотную к выбранному: неделя перед неделей, тридцать
 * дней перед тридцатью.
 *
 * С ним сравнивается балл сотрудника.
 *
 * @param period Период.
 * @returns Предыдущий период.
 */
export function previousPeriod(period: Period): Period {
  const span = Date.parse(`${period.to}T00:00:00Z`) - Date.parse(`${period.from}T00:00:00Z`);
  const days = Math.max(1, Math.round(span / 86_400_000) + 1);
  const to = shiftDay(period.from, -1);
  return { from: shiftDay(to, 1 - days), to };
}
