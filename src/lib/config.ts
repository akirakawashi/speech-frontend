import type { RuntimeConfig } from '@/lib/runtime-config';

export type { RuntimeConfig };

/**
 * Конфигурация приезжает с сервера один раз за загрузку страницы.
 *
 * Обещание запоминается, а не результат: половина приложения спрашивает
 * настройки одновременно при монтировании, и без этого браузер отправил бы
 * десяток одинаковых запросов, а гонка между ними дала бы разным частям экрана
 * разные ответы.
 */
let pending: Promise<RuntimeConfig> | null = null;
let loaded: RuntimeConfig | null = null;

export const DEFAULT_CONFIG: RuntimeConfig = {
  apiUrl: '',
  authMode: 'keycloak',
  keycloak: {
    url: '',
    realm: '',
    clientId: '',
    responseMode: 'fragment',
    scope: 'openid profile email',
    pkceEnabled: true,
  },
  displayTimezone: 'Europe/Moscow',
};

export async function loadConfig(): Promise<RuntimeConfig> {
  if (loaded) return loaded;
  if (!pending) {
    pending = fetch('/config.json', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`config.json: HTTP ${response.status}`);
        }
        return (await response.json()) as RuntimeConfig;
      })
      .then((config) => {
        loaded = config;
        return config;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/**
 * Уже загруженная конфигурация — для кода, который не может ждать (сборка
 * заголовка запроса внутри уже начатого действия). Возвращает умолчание, а не
 * бросает: умолчание — «keycloak и пустые адреса», то есть отказ, а не тихое
 * открытие доступа.
 */
export function currentConfig(): RuntimeConfig {
  return loaded ?? DEFAULT_CONFIG;
}

/** Только для тестов: сбросить запомненное между случаями. */
export function resetConfigCache(next: RuntimeConfig | null = null): void {
  loaded = next;
  pending = null;
}
