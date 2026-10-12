import { displayTimeZone } from '@/shared/config';

/**
 * Записывает момент времени датой и временем в поясе стенда.
 *
 * @param iso Момент в виде ISO 8601.
 * @returns Строка вида `14.09.2026, 10:15`.
 */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: displayTimeZone(),
  }).format(new Date(iso));
}

/**
 * Записывает момент времени датой в поясе стенда.
 *
 * @param iso Момент в виде ISO 8601.
 * @returns Строка вида `14.09.2026`.
 */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: displayTimeZone(),
  }).format(new Date(iso));
}

/**
 * Записывает длительность минутами и секундами.
 *
 *  `7:05`, а не «425 секунд»: длительность разговора читают глазами.
 *
 * @param seconds Длительность в секундах.
 * @returns Строка вида `7:05`.
 */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/**
 * Выбирает русское окончание счётного существительного под число.
 *
 * Без них интерфейс пишет «найдено 2 разговоров», и это первое, что замечают.
 *
 * @param count Число, с которым стоит слово.
 * @param one Форма для одного: «разговор».
 * @param few Форма для двух — четырёх: «разговора».
 * @param many Форма для пяти и больше: «разговоров».
 * @returns Подходящая форма слова.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/**
 * Записывает число вместе со словом в нужной форме.
 *
 * @param count Число.
 * @param one Форма слова для одного.
 * @param few Форма слова для двух — четырёх.
 * @param many Форма слова для пяти и больше.
 * @returns Строка вида `1 240 разговоров`.
 */
export function formatCount(count: number, one: string, few: string, many: string): string {
  return `${count.toLocaleString('ru-RU')} ${plural(count, one, few, many)}`;
}

/**
 * Записывает долю 0–1 процентами, целым числом.
 *
 * @param share Доля от 0 до 1.
 * @returns Целое число процентов со знаком `%`.
 */
export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/**
 * Записывает возраст в секундах крупными единицами: «2 ч 15 мин».
 *
 * @param seconds Возраст в секундах; `null` или `undefined` — возраста нет.
 * @returns Строка вида `45 с`, `12 мин` или `2 ч 15 мин`; прочерк, если возраста нет.
 */
export function formatAge(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} с`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}
