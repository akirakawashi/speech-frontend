import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, resetConfigCache } from '@/shared/config';
import { issueAudioTicket } from './audio-ticket';

/**
 * Подменяет сеть ответом с заданным кодом и телом.
 *
 * @param status Код ответа HTTP.
 * @param body Тело ответа; уходит как JSON.
 * @returns Подмена `fetch`, которая запоминает свои вызовы.
 */
function respond(status: number, body: unknown = {}): ReturnType<typeof vi.fn> {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  resetConfigCache({ ...DEFAULT_CONFIG, authMode: 'open' });
});

describe('кука для тега audio (SP-808)', () => {
  it('запрашивается с credentials: без них fetch не примет Set-Cookie', async () => {
    const fetchMock = respond(200, { expires_in: 900, issued: true });
    vi.stubGlobal('fetch', fetchMock);

    const ticket = await issueAudioTicket();

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    // Без этого запрос отработал бы «успешно», не сделав единственного, ради
    // чего он есть.
    expect(init.credentials).toBe('same-origin');
    expect(ticket.issued).toBe(true);
  });
});
