import { describe, expect, it, vi } from 'vitest';
import { currentConfig, DEFAULT_CONFIG, loadConfig, resetConfigCache } from './config';
import { buildRuntimeConfig } from './runtime-config';

describe('конфигурация читается в рантайме', () => {
  it('собирается из окружения, а не из бандла', () => {
    const config = buildRuntimeConfig({
      SPEECH_API_URL: 'https://speech.ic-group.ru/',
      SPEECH_AUTH_MODE: 'keycloak',
      SPEECH_KEYCLOAK_URL: 'https://kc.ic-group.ru/',
      SPEECH_KEYCLOAK_REALM: 'icg',
      SPEECH_KEYCLOAK_CLIENT_ID: 'speech',
      SPEECH_DISPLAY_TIMEZONE: 'Asia/Yekaterinburg',
    });

    // Хвостовой слэш снимается на сервере: иначе каждый адрес собирался бы с
    // двойным, а `speech-edge` на двойном слэше уже спотыкался (дефект 18).
    expect(config.apiUrl).toBe('https://speech.ic-group.ru');
    expect(config.keycloak.url).toBe('https://kc.ic-group.ru');
    expect(config.displayTimezone).toBe('Asia/Yekaterinburg');
  });

  it('пустой SPEECH_API_URL означает тот же источник', () => {
    expect(buildRuntimeConfig({}).apiUrl).toBe('');
  });

  it.each(['', 'kaycloak', 'OPEN_MODE', 'true'])(
    'непонятный режим входа %s трактуется как keycloak',
    (mode) => {
      // Отказ в сторону запрета: опечатка в настройке не должна открывать
      // доступ к записям разговоров.
      expect(buildRuntimeConfig({ SPEECH_AUTH_MODE: mode }).authMode).toBe('keycloak');
    },
  );

  it.each(['open', 'OPEN', ' Open '])('режим %s распознаётся', (mode) => {
    expect(buildRuntimeConfig({ SPEECH_AUTH_MODE: mode }).authMode).toBe('open');
  });

  it('PKCE выключается только явным false', () => {
    const off = buildRuntimeConfig({ SPEECH_KEYCLOAK_PKCE_ENABLED: 'false' });
    const onByDefault = buildRuntimeConfig({});
    const onByGarbage = buildRuntimeConfig({
      SPEECH_KEYCLOAK_PKCE_ENABLED: 'no',
    });

    expect(off.keycloak.pkceEnabled).toBe(false);
    expect(onByDefault.keycloak.pkceEnabled).toBe(true);
    expect(onByGarbage.keycloak.pkceEnabled).toBe(true);
  });
});

describe('загрузка конфигурации в браузере', () => {
  it('запрашивается один раз даже при десяти одновременных вызовах', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ...DEFAULT_CONFIG, apiUrl: '/x' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    resetConfigCache();

    const all = await Promise.all(Array.from({ length: 10 }, () => loadConfig()));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Set(all.map((item) => item.apiUrl))).toEqual(new Set(['/x']));
  });

  it('до загрузки текущая конфигурация — отказ, а не открытый доступ', () => {
    resetConfigCache();

    expect(currentConfig().authMode).toBe('keycloak');
    expect(currentConfig().keycloak.clientId).toBe('');
  });

  it('отказ сервера не подменяется умолчанием молча', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );
    resetConfigCache();

    await expect(loadConfig()).rejects.toThrow('config.json: HTTP 500');
  });
});
