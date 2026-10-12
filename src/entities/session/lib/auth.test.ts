import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, type RuntimeConfig, resetConfigCache } from '@/shared/config';
import {
  getDisplayInitials,
  getDisplayName,
  isOpenMode,
  startLogin,
  startLogout,
  takeAuthError,
} from './auth';

/**
 * Набор переписан целиком вместе с самим входом (ADR-SPEECH-0002).
 *
 * Прежний проверял PKCE, `state`, `nonce`, хранилище токенов и одиночный полёт
 * обновления. Ничего этого в браузере больше нет: клиент `speech`
 * конфиденциальный, обмен кода делает сервер. Те проверки переехали в
 * `aicistent-backend/tests/test_speech_auth_bff.py` — туда же, куда переехал
 * код, который они проверяли.
 *
 * Здесь осталось три вопроса: куда уводит вход, куда уводит выход и что
 * человек видит, когда его не пустили.
 */

const KEYCLOAK: RuntimeConfig = { ...DEFAULT_CONFIG, authMode: 'keycloak' };

/**
 * Подменяет адрес страницы и историю браузера.
 *
 * @param href Адрес, на котором «открыта» страница.
 * @returns Подмена `location.assign`: по ней тест видит, куда приложение увело пользователя.
 */
function stubLocation(href: string): { assign: ReturnType<typeof vi.fn> } {
  const assign = vi.fn();
  const url = new URL(href);
  vi.stubGlobal('location', {
    href,
    origin: url.origin,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    assign,
  });
  vi.stubGlobal('history', { replaceState: vi.fn() });
  return { assign };
}

beforeEach(() => {
  resetConfigCache(KEYCLOAK);
});

describe('старт входа', () => {
  it('уводит на сервис, а не на Keycloak: секрет в браузер не кладут', async () => {
    const { assign } = stubLocation('https://speech.test/calls/42?q=тариф');

    await startLogin();

    const target = String(assign.mock.calls[0]?.[0]);
    expect(target.startsWith('/api/v1/auth/login?next=')).toBe(true);
    // Браузер о Keycloak вообще ничего не знает.
    expect(target).not.toContain('openid-connect');
  });

  it('запоминает, откуда человек пришёл, вместе с параметрами поиска', async () => {
    const { assign } = stubLocation(
      'https://speech.test/calls/42?q=%D1%82%D0%B0%D1%80%D0%B8%D1%84',
    );

    await startLogin();

    const next = new URLSearchParams(String(assign.mock.calls[0]?.[0]).split('?')[1]).get('next');
    expect(next).toBe('/calls/42?q=%D1%82%D0%B0%D1%80%D0%B8%D1%84');
  });

  it('в режиме open вход не изображается', async () => {
    resetConfigCache({ ...DEFAULT_CONFIG, authMode: 'open' });
    const { assign } = stubLocation('https://speech.test/');

    await startLogin();

    expect(assign).not.toHaveBeenCalled();
    expect(isOpenMode()).toBe(true);
  });

  it('заданный адрес API подставляется: фронт и сервис могут жить врозь', async () => {
    resetConfigCache({ ...KEYCLOAK, apiUrl: 'https://api.speech.test' });
    const { assign } = stubLocation('https://speech.test/');

    await startLogin();

    expect(String(assign.mock.calls[0]?.[0])).toContain(
      'https://api.speech.test/api/v1/auth/login?next=',
    );
  });
});

describe('выход', () => {
  it('сначала гасит сессию на сервере, потом уводит на Keycloak', async () => {
    const { assign } = stubLocation('https://speech.test/calls/1');
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ logout_url: 'https://kc.test/logout' })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await startLogout();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/api/v1/auth/logout');
    expect(init.method).toBe('POST');
    // Без этого кука не уйдёт и гасить будет нечего.
    expect(init.credentials).toBe('same-origin');
    expect(assign).toHaveBeenCalledWith('https://kc.test/logout');
  });

  it('отказ сети не запирает человека внутри', async () => {
    const { assign } = stubLocation('https://speech.test/calls/1');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    await startLogout();

    // Сессия могла остаться живой, но держать человека на экране, который
    // выглядит рабочим, нельзя.
    expect(assign).toHaveBeenCalledWith('/');
  });
});

describe('причина отказа', () => {
  it('«нет групп» объясняется так, чтобы человек не ходил по кругу', () => {
    stubLocation('https://speech.test/?auth_error=no_groups');

    const message = takeAuthError();

    expect(message).toContain('не назначена ни одна группа');
    // Повторный вход отработает безупречно и снова не пустит — и это надо
    // сказать, иначе человек будет нажимать «войти» до конца дня.
    expect(message).toContain('Повторный вход не поможет');
  });

  it('код вычищается из адреса: иначе перезагрузка вечно показывает вчерашнюю ошибку', () => {
    stubLocation('https://speech.test/calls?auth_error=state_mismatch&q=a');
    const replaceState = vi.fn();
    vi.stubGlobal('history', { replaceState });

    takeAuthError();

    expect(replaceState).toHaveBeenCalledWith({}, expect.anything(), '/calls?q=a');
  });

  it('без кода — ничего', () => {
    stubLocation('https://speech.test/calls?q=a');

    expect(takeAuthError()).toBeNull();
  });

  it('незнакомый код не теряется молча', () => {
    stubLocation('https://speech.test/?auth_error=нечто_новое');

    expect(takeAuthError()).toContain('нечто_новое');
  });
});

describe('подпись человека', () => {
  it('имя предпочитается логину и почте', () => {
    expect(getDisplayName({ display_name: 'Иван Петров', username: 'ivanov' })).toBe('Иван Петров');
    expect(getDisplayName({ username: 'ivanov' })).toBe('ivanov');
    expect(getDisplayName({})).toBe('Авторизован');
  });

  it('инициалы берутся из имени, а не из почты, когда имя есть', () => {
    expect(getDisplayInitials({ display_name: 'Иван Петров', email: 'zzz@x' })).toBe('ИП');
  });
});
