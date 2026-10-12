import type { CallSource } from '@/api/client';
import { currentConfig } from '@/lib/config';

/**
 * Показ времени в часовом поясе, объявленном стендом, а не браузером.
 *
 * Колл-центр в Москве, а смотреть отчёт может человек из другого пояса —
 * и «звонок в 03:15» вместо «в 06:15» превращает разбор жалобы в спор о том,
 * когда это было. Хранится всё в UTC, пояс — только показ.
 */
function timeZone(): string {
  return currentConfig().displayTimezone || 'Europe/Moscow';
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timeZone(),
  }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: timeZone(),
  }).format(new Date(iso));
}

/** `7:05`, а не «425 секунд»: длительность разговора читают глазами. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/**
 * Русские окончания для счётных существительных. Без них интерфейс пишет
 * «найдено 2 разговоров», и это первое, что замечают.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function formatCount(count: number, one: string, few: string, many: string): string {
  return `${count.toLocaleString('ru-RU')} ${plural(count, one, few, many)}`;
}

export const SENTIMENT_LABEL: Record<string, string> = {
  negative: 'негативный',
  neutral: 'нейтральный',
  positive: 'позитивный',
};

export const SENTIMENT_GLYPH: Record<string, string> = {
  negative: '▼',
  neutral: '■',
  positive: '▲',
};

export const SEGMENT_LABEL: Record<string, string> = {
  b2b: 'юрлицо',
  individual: 'физлицо',
};

export const PRODUCT_LABEL: Record<string, string> = {
  wallet: 'Кошелёк',
  mobile: 'Мобильная связь',
  broadband: 'ШПД',
};

/**
 * Источник звонка (S-35) — одна подпись на вкладки «Диалогов», карточку
 * разговора и выбор в отчёте: назови их по-разному, и человек решит, что это
 * разные срезы. Ключ — перечисление из схемы API, поэтому новый источник без
 * подписи не соберётся.
 */
export const SOURCE_LABEL: Record<CallSource, string> = {
  ncc: 'Входящие · NCC',
  telphin: 'Исходящие · Телфин',
};

/**
 * Как фильтр «Диалогов» называет проект звонка — по вкладке (S-35). У NCC
 * проект несёт очередь обращений, у исходящих Телфина очереди нет, есть проект
 * «Телфин · исходящие ШПД». Подсказка карточки результата говорит о нём то же
 * («взято из проекта Телфина»), и одно и то же на одной вкладке не должно
 * называться двумя словами.
 */
export const PROJECT_FILTER_LABEL: Record<CallSource, string> = {
  ncc: 'Очередь',
  telphin: 'Проект',
};

/**
 * Почему записи нет. Три причины различимы в `audio_status`, и показывать
 * «файл не найден» там, где запись удалена по сроку хранения, значит выдавать
 * соблюдение политики за поломку (SRC-06, состояние 05).
 */
export const AUDIO_STATUS_NOTE: Record<string, string> = {
  deleted_by_retention: 'Запись удалена по сроку хранения — транскрипт доступен',
  unavailable_at_source: 'Записи не было у источника — транскрипт доступен',
  pending: 'Запись ещё не забрана из источника',
};
