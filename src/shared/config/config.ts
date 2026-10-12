import type { RuntimeConfig } from './runtime-config';

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
  displayTimezone: 'Europe/Moscow',
};

/**
 * Загружает конфигурацию стенда; повторные вызовы получают тот же ответ.
 *
 * @returns Конфигурация стенда.
 * @throws {Error} `/config.json` ответил отказом.
 */
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
 * Отдаёт уже загруженную конфигурацию — для кода, который не может ждать (сборка заголовка запроса
 * внутри уже начатого действия).
 *
 * Возвращает умолчание, а не бросает: умолчание — «keycloak и пустые адреса», то есть отказ, а не
 * тихое открытие доступа.
 *
 * @returns Конфигурация стенда или умолчание, если она ещё не загружена.
 */
export function currentConfig(): RuntimeConfig {
  return loaded ?? DEFAULT_CONFIG;
}

/**
 * Сбрасывает запомненную конфигурацию между случаями — только для тестов.
 *
 * @param next Конфигурация, которую считать загруженной; `null` — никакой.
 */
export function resetConfigCache(next: RuntimeConfig | null = null): void {
  loaded = next;
  pending = null;
}

/** Пояс показа, когда стенд его не назвал: колл-центр работает по Москве. */
const FALLBACK_TIME_ZONE = 'Europe/Moscow';

/**
 * Называет часовой пояс, в котором экраны показывают время и считают сутки.
 *
 * Пояс объявляет стенд, а не браузер: смотреть отчёт может человек из другого
 * пояса, и «звонок в 03:15» вместо «в 06:15» превращает разбор жалобы в спор о
 * том, когда это было. Хранится всё в UTC, пояс — только показ.
 *
 * @returns Название пояса IANA из конфигурации стенда; `Europe/Moscow`, если оно не задано.
 */
export function displayTimeZone(): string {
  return currentConfig().displayTimezone || FALLBACK_TIME_ZONE;
}
