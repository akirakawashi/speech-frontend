/**
 * Форма конфигурации и её сборка из окружения.
 *
 * Живёт отдельно от самого маршрута, и это не вкусовщина: файл
 * `route.ts` в App Router может экспортировать только обработчики методов и
 * закрытый список настроек. Любой другой экспорт оттуда ломает сборку —
 * причём на стадии проверки типов, сообщением про `OmitWithTag`, по которому
 * причину угадать нельзя.
 */

export type RuntimeConfig = {
  apiUrl: string;
  authMode: 'open' | 'keycloak';
  keycloak: {
    url: string;
    realm: string;
    clientId: string;
    responseMode: string;
    scope: string;
    pkceEnabled: boolean;
  };
  displayTimezone: string;
};

/** Простой словарь, а не `NodeJS.ProcessEnv`: читаются только строковые ключи,
 * а `ProcessEnv` требует `NODE_ENV` и превращает каждый тестовый набор в приведение типа. */
export type EnvSource = Record<string, string | undefined>;

/**
 * Собирает конфигурацию фронта из переменных окружения.
 *
 * @param source Переменные окружения; по умолчанию — окружение процесса.
 * @returns Конфигурация с умолчаниями на месте незаданных переменных.
 */
export function buildRuntimeConfig(source: EnvSource = process.env): RuntimeConfig {
  /**
   * Читает переменную окружения без пробелов по краям.
   *
   * @param name Имя переменной.
   * @param fallback Значение, если переменная не задана.
   * @returns Значение переменной или запасное.
   */
  const read = (name: string, fallback = '') => (source[name] ?? fallback).trim();
  // Режим сверяется с закрытым набором. Опечатка в `SPEECH_AUTH_MODE` иначе
  // дала бы «не keycloak», то есть открытый доступ, — отказ в сторону
  // разрешения на настройке, у которой цена ошибки — записи разговоров.
  const declared = read('SPEECH_AUTH_MODE', 'keycloak').toLowerCase();
  const authMode: RuntimeConfig['authMode'] = declared === 'open' ? 'open' : 'keycloak';
  return {
    // Пусто — значит «тот же источник»: фронт и API за одним `speech-edge`,
    // и в этом случае относительный путь надёжнее любого адреса.
    apiUrl: read('SPEECH_API_URL').replace(/\/+$/, ''),
    authMode,
    keycloak: {
      url: read('SPEECH_KEYCLOAK_URL').replace(/\/+$/, ''),
      realm: read('SPEECH_KEYCLOAK_REALM'),
      clientId: read('SPEECH_KEYCLOAK_CLIENT_ID'),
      responseMode: read('SPEECH_KEYCLOAK_RESPONSE_MODE', 'fragment'),
      scope: read('SPEECH_KEYCLOAK_SCOPE', 'openid profile email'),
      pkceEnabled: read('SPEECH_KEYCLOAK_PKCE_ENABLED', 'true').toLowerCase() !== 'false',
    },
    displayTimezone: read('SPEECH_DISPLAY_TIMEZONE', 'Europe/Moscow'),
  };
}
