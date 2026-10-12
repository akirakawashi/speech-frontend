import { ApiError } from '@/shared/api';

/**
 * Отказ показывается по классу, а не одним текстом на все случаи.
 *
 * «Что-то пошло не так» одинаково выглядит при отсутствии прав, недоступном
 * сервисе и неверном значении — и превращает разбор любой жалобы в разговор
 * вслепую. Детали от сервера при этом не выбрасываются: в них обычно и лежит
 * ответ.
 */
/**
 * Коды отказов сервиса и что они значат для человека.
 *
 * Сервер отвечает машине: его коды нужны такими в тестах и логах. Но в баннере
 * `call_has_queued_or_running_jobs` — это не сообщение, а строка, которую
 * читатель не обязан понимать. Неизвестный код показывается как есть: выдумать
 * ему текст значило бы соврать.
 */
const REFUSAL_TEXT: Record<string, string> = {
  call_has_queued_or_running_jobs:
    'У звонка есть незавершённые задания. Переобработка их бы дублировала — дождись, пока очередь дойдёт до конца, или сними задание на экране заданий.',
  job_is_not_failed_or_dead:
    'Повторить можно только задание со сбоем или с исчерпанными попытками.',
  pipeline_is_busy: 'Конвейер занят другой перестройкой. Повтори через минуту.',
  nothing_to_change: 'В запросе нет ни одного изменения.',
  not_found: 'Запись не найдена — возможно, её уже изменили.',
  ncc_not_configured:
    'Синхронизация не настроена: не заданы адрес NCC, логин или токен. Это правится в развёртывании, повторное нажатие не поможет.',
};

/**
 * Переводит код отказа сервиса в слова.
 *
 * @param detail Причина отказа из ответа сервера.
 * @returns Текст для человека или `null`, если код незнаком.
 */
function refusalText(detail: string): string | null {
  const key = detail.trim();
  if (REFUSAL_TEXT[key]) return REFUSAL_TEXT[key];
  // `unknown_settings: retention_dayz` — код с уточнением после двоеточия.
  const prefix = key.split(':', 1)[0]?.trim() ?? '';
  if (prefix === 'ncc' || key.startsWith('ncc_'))
    return `NCC ответил отказом (${key.replace(/^ncc_/, '')}). Справочники не изменены.`;
  if (prefix === 'unknown_settings')
    return `Сервер не знает такой настройки (${key.slice(prefix.length + 1).trim()}).`;
  return null;
}

/**
 * Объясняет отказ действия администрирования словами.
 *
 * @param error Ошибка запроса или изменения.
 * @returns Текст для баннера: что случилось и что делать дальше.
 */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    const known = refusalText(error.detail);
    if (known) return known;
    switch (error.kind) {
      case 'forbidden':
        return 'Недостаточно прав: действие доступно группе speech_admin.';
      case 'unauthorized':
        return 'Сессия истекла. Обнови страницу, чтобы войти заново.';
      case 'not_found':
        return 'Запись не найдена — возможно, её уже изменили.';
      case 'conflict':
        return error.detail || 'Изменение конфликтует с текущим состоянием.';
      case 'invalid':
        return error.detail || 'Значение не принято сервером.';
      case 'unavailable':
        return 'Сервис недоступен. Данные не изменены.';
      case 'network':
        return 'Нет связи с сервисом. Данные не изменены.';
      default:
        return error.detail || `Ошибка ${error.status}.`;
    }
  }
  return String(error instanceof Error ? error.message : error);
}
