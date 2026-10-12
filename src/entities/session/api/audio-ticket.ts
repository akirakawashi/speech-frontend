import { request } from '@/shared/api';
export type AudioTicket = { expires_in: number; issued: boolean };

/**
 * Перевыпускает куку для тега `<audio>`.
 *
 * Вызывается при входе и вместе с обновлением токена. Кука `HttpOnly` —
 * прочитать её и узнать оставшийся срок нельзя, поэтому фронт полагается на
 * `expires_in` из ответа, а не на её содержимое.
 *
 * `credentials: 'same-origin'` обязателен: без него `fetch` не примет
 * `Set-Cookie`, и запрос отработает «успешно», не сделав единственного, ради
 * чего он есть.
 *
 * @returns Срок жизни куки в секундах и признак того, что она выдана.
 * @throws {ApiError} Сервис отказал или не ответил.
 */
export async function issueAudioTicket(): Promise<AudioTicket> {
  return request<AudioTicket>('/api/v1/session/audio', {
    method: 'POST',
    credentials: 'same-origin',
  });
}

/**
 * Гасит куку для тега `<audio>`.
 *
 * @throws {ApiError} Сервис отказал или не ответил.
 */
export async function revokeAudioTicket(): Promise<void> {
  await request('/api/v1/session/audio', { method: 'DELETE', credentials: 'same-origin' });
}
