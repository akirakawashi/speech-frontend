import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, resetConfigCache } from '@/shared/config';
import { apiUrl, request } from './client';

const OPEN = { ...DEFAULT_CONFIG, authMode: 'open' as const };
const KEYCLOAK = {
  ...DEFAULT_CONFIG,
  authMode: 'keycloak' as const,
  keycloak: { ...DEFAULT_CONFIG.keycloak, url: 'https://kc.test', realm: 'r', clientId: 'c' },
};

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
  resetConfigCache(OPEN);
  sessionStorage.clear();
});

describe('адрес API', () => {
  it('пустая база означает тот же источник', () => {
    expect(apiUrl('/api/v1/search')).toBe('/api/v1/search');
  });

  it('заданная база подставляется без двойного слэша', () => {
    resetConfigCache({ ...OPEN, apiUrl: 'https://speech.test' });

    expect(apiUrl('/api/v1/search')).toBe('https://speech.test/api/v1/search');
  });
});

describe('сборка запроса', () => {
  it('пустые фильтры не уходят на сервер, а ноль и false — уходят', async () => {
    const fetchMock = respond(200, { ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await request('/api/v1/search', {
      query: { q: '', operator_id: null, topic_id: undefined, page: 0, exact: false },
    });

    const sent = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(sent.searchParams.has('q')).toBe(false);
    expect(sent.searchParams.has('operator_id')).toBe(false);
    expect(sent.searchParams.has('topic_id')).toBe(false);
    expect(sent.searchParams.get('page')).toBe('0');
    expect(sent.searchParams.get('exact')).toBe('false');
  });

  it('в режиме open заголовок авторизации не добавляется', async () => {
    const fetchMock = respond(200);
    vi.stubGlobal('fetch', fetchMock);

    await request('/api/v1/me');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('в режиме keycloak личность несёт кука, а не заголовок', async () => {
    // Токенов в браузере больше нет вовсе (ADR-SPEECH-0002): клиент
    // конфиденциальный, обмен кода делает сервер, браузеру достаётся кука.
    resetConfigCache(KEYCLOAK);
    const fetchMock = respond(200);
    vi.stubGlobal('fetch', fetchMock);

    await request('/api/v1/me');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(init.credentials).toBe('same-origin');
  });
});

describe('классификация отказов', () => {
  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [422, 'invalid'],
    [502, 'unavailable'],
    [503, 'unavailable'],
    [500, 'unexpected'],
  ])('HTTP %i — это %s', async (status, kind) => {
    vi.stubGlobal('fetch', respond(status, { detail: 'сообщение' }));

    await expect(request('/api/v1/search')).rejects.toMatchObject({ kind, status });
  });

  it('отказ сети не выдаётся за ошибку данных', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    await expect(request('/api/v1/search')).rejects.toMatchObject({ kind: 'network' });
  });

  it('401 остаётся отказом, а не молчаливой пустотой', async () => {
    // Чистить в браузере нечего — там ничего и не лежит. Решение принимает
    // `SessionProvider`: он уводит на вход.
    resetConfigCache(KEYCLOAK);
    vi.stubGlobal('fetch', respond(401, { detail: 'unauthorized' }));

    await expect(request('/api/v1/me')).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('нечитаемое тело отказа не превращается в падение разбора', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>502</html>', { status: 502 })),
    );

    await expect(request('/api/v1/search')).rejects.toMatchObject({
      kind: 'unavailable',
      detail: '',
    });
  });
});

describe('личность запроса', () => {
  it('теперь credentials несут ВСЕ запросы, а не только выдача куки', async () => {
    // Обратное прежнему поведению, и это не послабление, а следствие: личность
    // переехала из заголовка в куку сессии (ADR-SPEECH-0002). Без
    // `credentials` браузер её не приложит, и каждый запрос отвечал бы `401`
    // при живой сессии — без единого сообщения о причине.
    const fetchMock = respond(200);
    vi.stubGlobal('fetch', fetchMock);

    await request('/api/v1/search');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).toBe('same-origin');
  });
});
