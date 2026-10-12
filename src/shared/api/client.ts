import { currentConfig } from '@/shared/config';
import type { components } from './schema';

/** Схемы контракта `speech.api`: срезы берут отсюда типы своих ответов. */
export type Schemas = components['schemas'];

/**
 * Класс отказа, а не текст. Интерфейс обязан по-разному показывать «нет
 * доступа», «не найдено» и «сервис не отвечает»: одинаковое «что-то пошло не
 * так» на все три превращает разбор любой жалобы в разговор вслепую.
 */
export type ApiErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'invalid'
  | 'unavailable'
  | 'network'
  | 'unexpected';

export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly detail: string;

  /**
   * Создаёт отказ API.
   *
   * @param status Код ответа HTTP; `0` — ответа не было.
   * @param detail Причина отказа из тела ответа.
   * @param kind Класс отказа.
   */
  constructor(status: number, detail: string, kind: ApiErrorKind) {
    super(detail || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.kind = kind;
  }
}

/**
 * Относит код ответа HTTP к классу отказа.
 *
 * @param status Код ответа HTTP.
 * @returns Класс отказа; `unexpected` — для кодов, которые интерфейс не различает.
 */
function kindOf(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 422) return 'invalid';
  if (status === 502 || status === 503 || status === 504) return 'unavailable';
  return 'unexpected';
}

/**
 * Строит адрес ручки API.
 *
 * @param path Путь ручки от корня API, с косой чертой в начале.
 * @returns Полный адрес, если API на другом источнике; иначе тот же путь.
 */
export function apiUrl(path: string): string {
  const base = currentConfig().apiUrl;
  return base ? `${base}${path}` : path;
}

/**
 * Достаёт причину отказа из тела ответа.
 *
 * @param response Ответ сервера с кодом отказа.
 * @returns Причина строкой; пустая строка, если тело не читается как JSON.
 */
async function readDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') return body.detail;
    return JSON.stringify(body.detail ?? '');
  } catch {
    return '';
  }
}

export type RequestOptions = {
  method?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Выполняет запрос к API и разбирает ответ.
 *
 * @param path Путь ручки от корня API.
 * @param options Метод, параметры строки запроса, тело и сигнал отмены.
 * @returns Тело ответа, разобранное из JSON; `undefined` для ответа `204`.
 * @throws {ApiError} Сервер ответил отказом или запрос не дошёл; класс отказа — в `kind`.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(apiUrl(path), window.location.origin);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    // Пустая строка — это «фильтр не задан», и отправлять её значит просить
    // сервер искать пустоту. `0` и `false` при этом задаются осознанно.
    if (value === null || value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      ...(options.signal ? { signal: options.signal } : {}),
      // Личность носит кука сессии, а не заголовок (ADR-SPEECH-0002). Без
      // `credentials` браузер её не приложит, и каждый запрос отвечал бы
      // `401` — при живой сессии и без единого сообщения о причине.
      credentials: 'same-origin',
    });
  } catch (cause) {
    // Отказ сети неотличим от отказа сервиса на этом уровне, и врать про
    // причину нельзя: показывается «сервис недоступен», а не «ошибка данных».
    throw new ApiError(0, String(cause), 'network');
  }

  if (response.status === 401) {
    // Сессии нет или она погашена. Чистить в браузере нечего — там ничего и
    // не лежит; решение принимает `SessionProvider`, который уводит на вход.
    throw new ApiError(401, await readDetail(response), 'unauthorized');
  }
  if (!response.ok) {
    throw new ApiError(response.status, await readDetail(response), kindOf(response.status));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
