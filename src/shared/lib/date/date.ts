/**
 * Записывает дату сутками UTC — так, как понимает `<input type="date">`.
 *
 * @param value Момент времени.
 * @returns Сутки в виде `YYYY-MM-DD`.
 */
export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Считает смещение часового пояса от UTC в заданный момент.
 *
 * Через `Intl`, а не таблицей: переход на летнее время и любые будущие правки
 * зоны приезжают с системой, а зашитое «+3» однажды разойдётся с реальностью
 * молча — сутки съедут на час, и это спишут на «странный поиск».
 *
 * @param moment Момент времени.
 * @param timeZone Название часового пояса IANA.
 * @returns Смещение в минутах; положительное — пояс восточнее Гринвича.
 */
function zoneOffsetMinutes(moment: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(moment);
  /**
   * Достаёт числом одну часть даты, разложенной по поясу.
   *
   * @param type Название части: `year`, `month`, `day`, `hour`, `minute` или `second`.
   * @returns Значение части; `0`, если её нет.
   */
  const at = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  // `hour` в формате `hour12: false` даёт 24 для полуночи в части сред.
  const asUtc = Date.UTC(
    at('year'),
    at('month') - 1,
    at('day'),
    at('hour') % 24,
    at('minute'),
    at('second'),
  );
  return (asUtc - moment.getTime()) / 60_000;
}

/**
 * Находит момент, с которого начинаются сутки в часовом поясе.
 *
 * Два прохода: смещение зависит от момента, а момент — от смещения. Первый
 * проход берёт смещение по «наивной» полуночи, второй уточняет его уже по
 * найденному моменту, и это снимает единственный случай, где первый ошибается
 * на час, — сутки перехода на летнее время.
 *
 * @param day Сутки в виде `YYYY-MM-DD`.
 * @param timeZone Название часового пояса IANA.
 * @returns Момент начала суток в виде ISO 8601, в UTC.
 */
export function dayStartInstant(day: string, timeZone: string): string {
  const naive = Date.parse(`${day}T00:00:00Z`);
  let instant = naive - zoneOffsetMinutes(new Date(naive), timeZone) * 60_000;
  instant = naive - zoneOffsetMinutes(new Date(instant), timeZone) * 60_000;
  return new Date(instant).toISOString();
}

/**
 * Находит следующие сутки.
 *
 * @param day Сутки в виде `YYYY-MM-DD`.
 * @returns Следующие сутки в том же виде.
 */
export function nextDay(day: string): string {
  const moment = new Date(`${day}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + 1);
  return isoDate(moment);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Проверяет сутки, пришедшие из адресной строки.
 *
 * Чужое значение — не значение: сутки из адреса уходят в `dayStartInstant`, и
 * `2026-13-45` уронило бы экран целиком вместо того, чтобы показать период по
 * умолчанию.
 *
 * @param value Значение параметра адреса; `null` — параметра нет.
 * @returns Те же сутки в виде `YYYY-MM-DD` или пустая строка, если это не существующая дата.
 */
export function parseDay(value: string | null): string {
  return value && DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : '';
}
