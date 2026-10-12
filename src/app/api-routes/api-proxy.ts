/**
 * Проброс `/api/*` на `speech-ms` силами самого фронта.
 *
 * Зачем. 2026-09-15 эксплуатация опубликовала `speech.ic-group.ru` целиком на
 * порт фронта: запросы к `/api/...` приходят сюда, а не на `speech-ms`.
 * Попросить у неё отдельный маршрут нельзя, а свой nginx перед фронтом решено не
 * заводить. Значит, отвечать на `/api` должен тот, до кого запрос доходит, — этот
 * процесс, пересылкой на адрес из окружения.
 *
 * Адрес читается **в момент запроса** (`SPEECH_API_PROXY_TARGET`), как и
 * `/config.json`: один образ на все стенды. Прежний проброс жил в `rewrites()`
 * `next.config.ts` и включался переменной разработки. Он запекается при сборке —
 * и запёкся: `.env.local` разработчика попал в образ, и продуктивный контейнер
 * пересылал `/api` на `127.0.0.1:18096`, то есть в самого себя (500 на каждый
 * запрос). Здесь той ловушки нет.
 *
 * Что соблюдается, и почему:
 * - тело и ответ идут потоком: записи разговоров — мегабайты;
 * - `Range` и `If-Range` проходят как есть — на них перемотка записи;
 * - редирект не выполняется, а передаётся браузеру: вход отвечает `303` на
 *   Keycloak, и идти туда должен браузер, а не этот процесс;
 * - каждая `Set-Cookie` передаётся отдельно: склеенные в одну строку, они
 *   ломаются на дате в `Expires`;
 * - заголовки одного соединения (`Connection`, `Transfer-Encoding` и т. п.)
 *   не пересылаются;
 * - у `speech-ms` просится ответ без сжатия: `fetch` распаковал бы тело, а
 *   заголовок `Content-Encoding` остался бы и соврал браузеру.
 */

export type ProxyEnv = Record<string, string | undefined>;

type FetchImpl = (input: string, init: RequestInit) => Promise<Response>;

/** Заголовки одного соединения: дальше этого узла они не идут ни в одну сторону. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/**
 * Читает из окружения адрес `speech-ms`, на который пересылаются запросы.
 *
 * @param env Переменные окружения; по умолчанию — окружение процесса.
 * @returns Адрес без косой черты в конце или `null`, если он не задан или не http(s).
 */
export function proxyTarget(env: ProxyEnv = process.env): string | null {
  const raw = (env.SPEECH_API_PROXY_TARGET ?? '').trim().replace(/\/+$/, '');
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Собирает отказ прокси в том же виде, в каком отказывает `speech-ms`.
 *
 * @param status Код ответа HTTP.
 * @param detail Причина отказа; уходит в поле `detail`.
 * @returns Ответ JSON, который запрещено кэшировать.
 */
function problem(status: number, detail: string): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/**
 * Пересылает запрос к `/api/*` на `speech-ms` и возвращает его ответ потоком.
 *
 * @param request Входящий запрос браузера.
 * @param options Подмены для тестов: окружение (`env`) и функция запроса (`fetchImpl`).
 * @returns Ответ `speech-ms` без заголовков одного соединения. `503` — адрес не задан, `404` — путь
 *   не `/api/`, `502` — `speech-ms` не ответил.
 */
export async function proxyApiRequest(
  request: Request,
  options: { env?: ProxyEnv; fetchImpl?: FetchImpl } = {},
): Promise<Response> {
  const target = proxyTarget(options.env ?? process.env);
  if (!target) {
    // Отказ со словами, а не молчаливый 404: без адреса `speech-ms` приложение
    // не работает вовсе, и причина должна быть видна в первом же ответе.
    return problem(503, 'SPEECH_API_PROXY_TARGET is not configured');
  }
  const incoming = new URL(request.url);
  if (!incoming.pathname.startsWith('/api/')) {
    return problem(404, 'not an API path');
  }

  const headers = new Headers();
  for (const [name, value] of request.headers) {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP.has(lower) || lower === 'host' || lower === 'content-length') continue;
    headers.set(name, value);
  }
  headers.set('accept-encoding', 'identity');
  headers.set('x-forwarded-host', request.headers.get('host') ?? incoming.host);
  headers.set(
    'x-forwarded-proto',
    request.headers.get('x-forwarded-proto') ?? incoming.protocol.replace(/:$/, ''),
  );

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  // `duplex` нужен `fetch` в Node для потокового тела запроса; в типе DOM его нет.
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
    redirect: 'manual',
    cache: 'no-store',
    signal: request.signal,
  };
  if (hasBody) {
    init.body = request.body;
    init.duplex = 'half';
  }

  let upstream: Response;
  try {
    upstream = await (options.fetchImpl ?? fetch)(
      `${target}${incoming.pathname}${incoming.search}`,
      init,
    );
  } catch {
    return problem(502, 'speech API is unreachable');
  }

  const responseHeaders = new Headers();
  const encoded = upstream.headers.has('content-encoding');
  for (const [name, value] of upstream.headers) {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP.has(lower) || lower === 'set-cookie' || lower === 'content-encoding') continue;
    if (encoded && lower === 'content-length') continue;
    responseHeaders.set(name, value);
  }
  const cookies =
    typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : [];
  for (const cookie of cookies) responseHeaders.append('set-cookie', cookie);

  const bodyless =
    method === 'HEAD' ||
    upstream.status === 204 ||
    upstream.status === 205 ||
    upstream.status === 304 ||
    (upstream.status >= 300 && upstream.status < 400);
  return new Response(bodyless ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
