// @vitest-environment node
// Окружение `node`, а не jsdom: пробросом занимается сервер Next на Node, а
// `Request` из jsdom молча выбрасывает заголовок `Range` — на нём перемотка
// записи, и проверять его в чужой реализации значит проверять не то.
import { describe, expect, it } from 'vitest';
import { proxyApiRequest, proxyTarget } from './api-proxy';

const ENV = { SPEECH_API_PROXY_TARGET: 'http://speech-ms:8096/' };

type Call = { url: string; init: RequestInit };

/**
 * Подменяет обращение к `speech-ms` и запоминает каждый вызов.
 *
 * @param respond Строит ответ по сделанному вызову.
 * @returns Список вызовов и функция, которую прокси получает вместо `fetch`.
 */
function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  /**
   * Запоминает вызов и отвечает на него заданным ответом.
   *
   * @param url Адрес, по которому прокси обратился к `speech-ms`.
   * @param init Параметры запроса: метод, заголовки и тело.
   * @returns Ответ, построенный для этого вызова.
   */
  const impl = async (url: string, init: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    return respond(call);
  };
  return { calls, impl };
}

/**
 * Достаёт единственный вызов `speech-ms`.
 *
 * @param calls Вызовы, которые запомнила подмена.
 * @returns Тот самый вызов.
 * @throws {Error} Вызовов не один: прокси обратился к `speech-ms` лишний раз или не обратился
 *   вовсе.
 */
function onlyCall(calls: Call[]): Call {
  const call = calls[0];
  if (!call || calls.length !== 1)
    throw new Error(`expected one upstream call, got ${calls.length}`);
  return call;
}

describe('адрес speech-ms', () => {
  it('берётся из окружения без хвостового слэша', () => {
    expect(proxyTarget(ENV)).toBe('http://speech-ms:8096');
  });

  it('пустой, мусорный или не http — это «не задан»', () => {
    expect(proxyTarget({})).toBeNull();
    expect(proxyTarget({ SPEECH_API_PROXY_TARGET: '  ' })).toBeNull();
    expect(proxyTarget({ SPEECH_API_PROXY_TARGET: 'not a url' })).toBeNull();
    expect(proxyTarget({ SPEECH_API_PROXY_TARGET: 'file:///etc/passwd' })).toBeNull();
  });
});

describe('проброс /api', () => {
  it('без адреса отвечает 503 со словами, а не молчаливым 404', async () => {
    const { calls, impl } = fakeFetch(() => new Response('never'));

    const response = await proxyApiRequest(new Request('http://front/api/v1/me'), {
      env: {},
      fetchImpl: impl,
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ detail: 'SPEECH_API_PROXY_TARGET is not configured' });
    expect(calls).toHaveLength(0);
  });

  it('не пересылает то, что не лежит под /api/', async () => {
    const { calls, impl } = fakeFetch(() => new Response('never'));

    const response = await proxyApiRequest(new Request('http://front/config.json'), {
      env: ENV,
      fetchImpl: impl,
    });

    expect(response.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it('переносит путь, запрос и нужные заголовки, но не заголовки соединения', async () => {
    const { calls, impl } = fakeFetch(() => new Response('{}', { status: 200 }));
    const query = '?q=%D0%B1%D0%B0%D0%BB%D0%B0%D0%BD%D1%81&page=2';

    await proxyApiRequest(
      new Request(`http://speech.ic-group.ru/api/v1/search${query}`, {
        headers: {
          cookie: 'speech_session=abc',
          range: 'bytes=100-',
          'if-range': '"etag"',
          connection: 'keep-alive',
          'x-forwarded-proto': 'https',
          'accept-encoding': 'gzip, br',
        },
      }),
      { env: ENV, fetchImpl: impl },
    );

    const { url, init } = onlyCall(calls);
    expect(url).toBe(`http://speech-ms:8096/api/v1/search${query}`);
    const headers = new Headers(init.headers);
    expect(headers.get('cookie')).toBe('speech_session=abc');
    expect(headers.get('range')).toBe('bytes=100-');
    expect(headers.get('if-range')).toBe('"etag"');
    expect(headers.has('connection')).toBe(false);
    expect(headers.get('accept-encoding')).toBe('identity');
    expect(headers.get('x-forwarded-proto')).toBe('https');
    expect(init.redirect).toBe('manual');
    expect(init.body).toBeUndefined();
  });

  it('отдаёт статус, тело и заголовки ответа, каждую куку отдельно', async () => {
    const upstreamHeaders = new Headers({
      'content-type': 'audio/mpeg',
      'content-range': 'bytes 100-199/1000',
      'content-length': '100',
      'accept-ranges': 'bytes',
    });
    upstreamHeaders.append('set-cookie', 'a=1; Path=/; Expires=Wed, 16 Sep 2026 10:00:00 GMT');
    upstreamHeaders.append('set-cookie', 'b=2; Path=/; HttpOnly');
    const { impl } = fakeFetch(
      () => new Response(new Uint8Array(100), { status: 206, headers: upstreamHeaders }),
    );

    const response = await proxyApiRequest(new Request('http://front/api/v1/calls/1/audio'), {
      env: ENV,
      fetchImpl: impl,
    });

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 100-199/1000');
    expect(response.headers.get('content-length')).toBe('100');
    expect(response.headers.getSetCookie()).toEqual([
      'a=1; Path=/; Expires=Wed, 16 Sep 2026 10:00:00 GMT',
      'b=2; Path=/; HttpOnly',
    ]);
    expect((await response.arrayBuffer()).byteLength).toBe(100);
  });

  it('редирект передаёт браузеру, а не выполняет сам', async () => {
    const keycloak = 'https://ssoc.ic-group.ru/realms/IC-GROUP/protocol/openid-connect/auth?x=1';
    const { impl } = fakeFetch(
      () => new Response(null, { status: 303, headers: { location: keycloak } }),
    );

    const response = await proxyApiRequest(new Request('http://front/api/v1/auth/login?next=/'), {
      env: ENV,
      fetchImpl: impl,
    });

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(keycloak);
    expect(response.body).toBeNull();
  });

  it('тело запроса уходит потоком', async () => {
    const { calls, impl } = fakeFetch(async ({ init }) => {
      const sent = await new Response(init.body as BodyInit).text();
      return new Response(sent, { status: 200 });
    });

    const response = await proxyApiRequest(
      new Request('http://front/api/v1/calls/1/reveal', {
        method: 'POST',
        body: JSON.stringify({ reason: 'проверка' }),
        headers: { 'content-type': 'application/json' },
      }),
      { env: ENV, fetchImpl: impl },
    );

    expect(onlyCall(calls).init.method).toBe('POST');
    expect(await response.text()).toBe(JSON.stringify({ reason: 'проверка' }));
  });

  it('сжатие не переносится: тело уже распаковано, заголовок соврал бы', async () => {
    const { impl } = fakeFetch(
      () =>
        new Response('{"ok":true}', {
          status: 200,
          headers: {
            'content-encoding': 'gzip',
            'content-length': '31',
            'content-type': 'application/json',
          },
        }),
    );

    const response = await proxyApiRequest(new Request('http://front/api/v1/me'), {
      env: ENV,
      fetchImpl: impl,
    });

    expect(response.headers.has('content-encoding')).toBe(false);
    expect(response.headers.has('content-length')).toBe(false);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('недоступный speech-ms — это 502, а не падение процесса', async () => {
    const { impl } = fakeFetch(() => {
      throw new TypeError('fetch failed');
    });

    const response = await proxyApiRequest(new Request('http://front/api/v1/me'), {
      env: ENV,
      fetchImpl: impl,
    });

    expect(response.status).toBe(502);
  });
});
