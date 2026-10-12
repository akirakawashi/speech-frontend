import type { CallSource } from './types';

export const SENTIMENT_LABEL: Record<string, string> = {
  negative: 'негативный',
  neutral: 'нейтральный',
  positive: 'позитивный',
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
