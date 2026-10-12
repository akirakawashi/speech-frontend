/**
 * Вход через BFF: браузер не разговаривает с Keycloak вовсе.
 *
 * Прежняя редакция делала Authorization Code + PKCE прямо здесь и держала
 * токены в `sessionStorage`. Это работает только с публичным клиентом, а
 * клиент `speech` в realm IC-GROUP — конфиденциальный, и таким останется:
 * правок на стороне Keycloak не будет. Проверено живьём — обмен кода без
 * секрета отвечает `unauthorized_client`.
 *
 * Поэтому обмен переехал на сервер (ADR-SPEECH-0002). Здесь осталось три
 * действия: уйти на вход, уйти на выход и прочитать причину отказа. Токенов в
 * браузере нет ни одного — межсайтовый скриптинг больше не может их вынести,
 * потому что выносить нечего.
 *
 * Пропало вместе с ними: `sessionStorage`, `state`, `nonce`, `code_verifier`,
 * одиночный полёт обновления и очистка адресной строки. Всё это теперь дело
 * сервера, и это минус один класс дефектов, а не просто минус код.
 */

import { currentConfig, loadConfig, type RuntimeConfig } from '@/shared/config';

/** Что сервис умеет ответить, когда вход не состоялся. */
export type AuthErrorCode =
  | 'no_groups'
  | 'state_mismatch'
  | 'nonce_mismatch'
  | 'exchange_failed'
  | 'token_invalid'
  | 'provider_error'
  | 'not_configured'
  | 'no_code';

/**
 * Объяснения словами, а не кодами.
 *
 * Разные причины требуют разных действий, и одинаковое «войдите ещё раз» на
 * все — худший из ответов: при `no_groups` повторный вход отработает
 * безупречно и снова не пустит, а человек будет ходить по кругу вместо того,
 * чтобы попросить группу.
 */
const AUTH_ERRORS: Record<AuthErrorCode, string> = {
  no_groups:
    'Доступ не выдан: учётной записи не назначена ни одна группа Speech Analytics. ' +
    'Повторный вход не поможет — нужна группа.',
  state_mismatch:
    'Вход не завершён: ответ Keycloak не совпал с начатой попыткой. Попробуйте снова.',
  nonce_mismatch:
    'Вход не завершён: ответ Keycloak не совпал с начатой попыткой. Попробуйте снова.',
  exchange_failed: 'Keycloak не выдал токен. Если это повторяется, сообщите администратору.',
  token_invalid: 'Keycloak выдал токен, который не прошёл проверку.',
  provider_error: 'Keycloak отказал во входе.',
  not_configured: 'Вход не настроен на стороне сервиса.',
  no_code: 'Вход не завершён: Keycloak не вернул код.',
};

/**
 * Проверяет, работает ли стенд без входа.
 *
 * @param config Конфигурация стенда; по умолчанию — уже загруженная.
 * @returns `true`, если режим входа — `open`.
 */
export function isOpenMode(config: RuntimeConfig = currentConfig()): boolean {
  return config.authMode === 'open';
}

/**
 * Строит адрес ручки входа на сервисе.
 *
 * @param path Путь ручки от корня API.
 * @returns Полный адрес, если API на другом источнике; иначе тот же путь.
 */
function authUrl(path: string): string {
  const base = currentConfig().apiUrl;
  return base ? `${base}${path}` : path;
}

/**
 * Собирает адрес текущей страницы внутри приложения: на него сервис вернёт после входа.
 *
 * @returns Путь со строкой запроса; `/`, если адрес пуст.
 */
function currentPath(): string {
  return `${window.location.pathname}${window.location.search}` || '/';
}

/**
 * Уйти на вход.
 *
 * Обычный переход, а не `fetch`: дальше браузер отправится на страницу
 * Keycloak, а перенаправление, полученное запросом, он бы проглотил молча.
 */
export async function startLogin(): Promise<void> {
  const config = await loadConfig();
  if (isOpenMode(config)) return;
  window.location.assign(
    `${authUrl('/api/v1/auth/login')}?next=${encodeURIComponent(currentPath())}`,
  );
}

/**
 * Гасит сессию на сервере и уводит на выход из Keycloak.
 *
 * Порядок именно такой. Сначала гаснет наша сессия — иначе уход на Keycloak
 * оставил бы её живой, и возврат по кнопке «назад» вернул бы работающий
 * интерфейс. Отказ сети при этом не должен запереть человека внутри: адрес
 * выхода не пришёл — уходим на корень, где его встретит форма входа.
 *
 * @returns `true`, если сервис назвал адрес выхода; `false` — пользователь уведён на корень.
 */
export async function startLogout(): Promise<boolean> {
  let logoutUrl = '';
  try {
    const response = await fetch(authUrl('/api/v1/auth/logout'), {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (response.ok) {
      logoutUrl = String(((await response.json()) as { logout_url?: string }).logout_url || '');
    }
  } catch {
    // Сеть отказала — сессия могла остаться живой, но держать человека на
    // экране, который выглядит рабочим, нельзя. Уводим на корень.
  }
  window.location.assign(logoutUrl || '/');
  return Boolean(logoutUrl);
}

/**
 * Читает из адреса причину несостоявшегося входа и убирает её оттуда.
 *
 * Сервис приводит сюда с `?auth_error=<код>`, а не отдаёт JSON: возврат от
 * Keycloak — верхнеуровневый переход, и сырой JSON на экране выглядит как
 * поломка сайта, а не как «вас не пустили».
 *
 * Код тут же вычищается из адреса: иначе он останется в истории браузера и
 * перезагрузка страницы будет вечно показывать вчерашнюю ошибку.
 *
 * @returns Причина словами или `null`, если вход не отказывал.
 */
export function takeAuthError(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const code = url.searchParams.get('auth_error');
  if (!code) return null;

  url.searchParams.delete('auth_error');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);

  return AUTH_ERRORS[code as AuthErrorCode] ?? `Вход не состоялся: ${code}.`;
}

/** Как подписать человека в углу экрана. */
export type DisplayIdentity = {
  display_name?: string | null;
  username?: string | null;
  email?: string | null;
};

/**
 * Выбирает, как подписать пользователя в углу экрана.
 *
 * @param identity Имя, логин и почта пользователя.
 * @returns Имя, а без него — логин или почта; «Авторизован», если нет ничего.
 */
export function getDisplayName(identity: DisplayIdentity = {}): string {
  return identity.display_name || identity.username || identity.email || 'Авторизован';
}

/**
 * Собирает инициалы пользователя для аватара.
 *
 * @param identity Имя, логин и почта пользователя.
 * @returns До двух заглавных букв; «ОК», если подписать нечем.
 */
export function getDisplayInitials(identity: DisplayIdentity = {}): string {
  return (
    getDisplayName(identity)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'ОК'
  );
}
