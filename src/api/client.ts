import type { components } from '@/api/schema';
import { currentConfig } from '@/lib/config';

type Schemas = components['schemas'];

export type MeResponse = Schemas['MeResponse'];
export type StatsResponse = Schemas['StatsResponse'];
export type SearchResponse = Schemas['SearchResponse'];
export type SearchItemModel = Schemas['SearchItemModel'];
export type CallResponse = Schemas['CallResponse'];
export type SegmentModel = Schemas['SegmentModel'];
export type QuoteModel = Schemas['QuoteModel'];
export type OptionsResponse = Schemas['OptionsResponse'];
export type ClassifierResponse = Schemas['ClassifierResponse'];
export type RevealResponse = Schemas['RevealResponse'];
export type CallQualityResponse = Schemas['CallQualityResponse'];
export type QualityStageModel = Schemas['QualityStageModel'];
export type QualityObjectionModel = Schemas['QualityObjectionModel'];
export type QualitySummaryResponse = Schemas['QualitySummaryResponse'];
export type QualityStageShare = Schemas['QualityStageShare'];
export type QualityObjectionShare = Schemas['QualityObjectionShare'];
export type QualityOutcomeShare = Schemas['QualityOutcomeShare'];
export type QualityOperatorScore = Schemas['QualityOperatorScore'];
export type QualityWeek = Schemas['QualityWeek'];
export type QualityCallsResponse = Schemas['QualityCallsResponse'];
export type QualityCallItem = Schemas['QualityCallItem'];
export type QualityCallStage = Schemas['QualityCallStage'];
export type QualityBuckets = Schemas['QualityBuckets'];
export type QualityOperatorStage = Schemas['QualityOperatorStage'];
export type DashboardResponse = Schemas['DashboardResponse'];
export type DashboardTheme = Schemas['DashboardTheme'];
export type DashboardBucket = Schemas['DashboardBucket'];
export type DashboardSelection = Schemas['DashboardSelection'];
export type DashboardSubtopic = Schemas['DashboardSubtopic'];
/** Чьи звонки (S-35): входящие NCC или исходящие ШПД Телфина. */
export type CallSource = Schemas['CallSource'];

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

  constructor(status: number, detail: string, kind: ApiErrorKind) {
    super(detail || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.kind = kind;
  }
}

function kindOf(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 422) return 'invalid';
  if (status === 502 || status === 503 || status === 504) return 'unavailable';
  return 'unexpected';
}

export function apiUrl(path: string): string {
  const base = currentConfig().apiUrl;
  return base ? `${base}${path}` : path;
}

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
  /** Нужен только выдаче куки для аудио: `fetch` иначе не примет `Set-Cookie`. */
  credentials?: RequestCredentials;
};

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
      credentials: options.credentials ?? 'same-origin',
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

/**
 * Ссылка на аудио. Плеер получает адрес, а не поток: перемотка — дело браузера,
 * и ради неё сервис транслирует `Range`.
 *
 * Заголовок `Authorization` браузер к этому запросу не добавит — `src` он
 * запрашивает сам. В режиме `keycloak` токен доставляется кукой `speech_audio`,
 * которую выдаёт `POST /api/v1/session/audio` (SP-808): она несёт **тот же
 * токен**, поэтому проверка роли на отдаче остаётся прежней. Отвергнутые
 * обходы: подписанная ссылка (действует сама по себе, минуя проверку роли),
 * токен в адресе (уедет в историю браузера и логи прокси), загрузка в `blob:`
 * (убивает перемотку, ради которой всё и сделано).
 */
export function audioUrl(callId: string, download = false): string {
  return apiUrl(`/api/v1/calls/${callId}/audio${download ? '?download=1' : ''}`);
}

export type AudioTicket = { expires_in: number; issued: boolean };

/**
 * Перевыпустить куку для тега `<audio>`.
 *
 * Вызывается при входе и вместе с обновлением токена. Кука `HttpOnly` —
 * прочитать её и узнать оставшийся срок нельзя, поэтому фронт полагается на
 * `expires_in` из ответа, а не на её содержимое.
 *
 * `credentials: 'same-origin'` обязателен: без него `fetch` не примет
 * `Set-Cookie`, и запрос отработает «успешно», не сделав единственного, ради
 * чего он есть.
 */
export async function issueAudioTicket(): Promise<AudioTicket> {
  return request<AudioTicket>('/api/v1/session/audio', {
    method: 'POST',
    credentials: 'same-origin',
  });
}

export async function revokeAudioTicket(): Promise<void> {
  await request('/api/v1/session/audio', { method: 'DELETE', credentials: 'same-origin' });
}
