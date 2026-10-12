import type { Product, Segment } from '@/entities/call';
import { DEFAULT_SOURCE, PRODUCTS, SEGMENTS, SOURCES } from '@/entities/call';
import { dayStartInstant, defaultPeriod, nextDay } from '@/shared/lib/date';
/**
 * Состояние экрана живёт в адресе, а не в памяти компонента (SRC-05, SP-504).
 *
 * Не ради красоты ссылок: пользователь колл-центра пересылает найденный
 * разговор коллеге, и «у меня открыто, а у тебя нет» — это не мелочь, а
 * невозможность вдвоём смотреть на одно. Перезагрузка страницы по той же
 * причине обязана вернуть тот же экран.
 *
 * Разбор терпимый, а сборка строгая: чужая ссылка с мусором в параметре должна
 * открыть экран с умолчанием, а не показать ошибку; свои ссылки при этом
 * собираются без пустых параметров, чтобы адрес читался.
 */

import type { CallSource } from '@/entities/call';
import { displayTimeZone } from '@/shared/config';

export type SearchState = {
  /**
   * Чьи звонки (S-35): входящие NCC или исходящие Телфина. Вкладка, а не ещё
   * один фильтр «любой»: у источников разные операторы, очереди и смысл
   * разговора, и общий список с общими KPI не описывал ни один из них.
   */
  source: CallSource;
  q: string;
  from: string;
  to: string;
  operatorId: string;
  projectId: string;
  /** Узел классификатора (SP-310): звонки его ветки по классификации ИИ. */
  nodeId: string;
  segment: Segment | '';
  product: Product | '';
  page: number;
  /** «Искать за всё время» — снятый период, а не период длиной в век. */
  allTime: boolean;
};

export const EMPTY_STATE: SearchState = {
  source: DEFAULT_SOURCE,
  q: '',
  from: '',
  to: '',
  operatorId: '',
  projectId: '',
  nodeId: '',
  segment: '',
  product: '',
  page: 1,
  allTime: false,
};

/**
 * Пропускает значение из адреса, только если оно из закрытого набора.
 *
 * @param value Значение параметра; `null` — параметра нет.
 * @param allowed Допустимые значения.
 * @returns То же значение или пустая строка, если оно не из набора.
 */
function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | '' {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : '';
}

/**
 * Разбирает состояние поиска из адресной строки.
 *
 * @param params Параметры адреса.
 * @param now Текущий момент: от него отсчитывается период по умолчанию.
 * @returns Состояние поиска; чужие и пустые значения заменены умолчаниями.
 */
export function parseSearchState(params: URLSearchParams, now: Date): SearchState {
  const allTime = params.get('period') === 'all';
  const fallback = defaultPeriod(now);
  const rawPage = Number.parseInt(params.get('page') ?? '', 10);
  return {
    // Неизвестный источник — вкладка по умолчанию, а не ошибка: так же, как
    // сегмент и продукт.
    source: oneOf(params.get('source'), SOURCES) || DEFAULT_SOURCE,
    q: params.get('q') ?? '',
    // Пустая строка периода при `period=all` — это «не сужать», и подставлять
    // туда умолчание значило бы отменять снятый пользователем фильтр.
    from: allTime ? '' : params.get('from') || fallback.from,
    to: allTime ? '' : params.get('to') || fallback.to,
    operatorId: params.get('operator_id') ?? '',
    projectId: params.get('project_id') ?? '',
    // Прежний `topic_id` (темы до SP-310) не читается: идентификатор темы — не
    // узел дерева, и выдача, суженная им, была бы пустой без объяснений.
    nodeId: params.get('node_id') ?? '',
    segment: oneOf(params.get('segment'), SEGMENTS),
    product: oneOf(params.get('product'), PRODUCTS),
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    allTime,
  };
}

/**
 * Записывает состояние поиска в параметры адреса.
 *
 *  Адрес без пустых параметров: он попадёт в переписку, и его будут читать.
 *
 * @param state Состояние поиска.
 * @returns Параметры адреса без пустых значений и умолчаний.
 */
export function toSearchParams(state: SearchState): URLSearchParams {
  const params = new URLSearchParams();
  // Умолчание в адрес не пишется, как и прочие пустые фильтры: адрес вкладки
  // NCC остаётся тем же, что был до Телфина.
  if (state.source !== DEFAULT_SOURCE) params.set('source', state.source);
  if (state.q.trim()) params.set('q', state.q.trim());
  if (state.allTime) {
    params.set('period', 'all');
  } else {
    if (state.from) params.set('from', state.from);
    if (state.to) params.set('to', state.to);
  }
  if (state.operatorId) params.set('operator_id', state.operatorId);
  if (state.projectId) params.set('project_id', state.projectId);
  if (state.nodeId) params.set('node_id', state.nodeId);
  if (state.segment) params.set('segment', state.segment);
  if (state.product) params.set('product', state.product);
  if (state.page > 1) params.set('page', String(state.page));
  return params;
}

/**
 * Собирает параметры запроса к ручке поиска.
 *
 * Границы периода — моменты времени **в зоне показа**.
 *
 * `<input type="date">` даёт только дату, а сервер ждёт момент. Считать его в
 * UTC, как делалось до 2026-09-17, нельзя: время звонка показывается в зоне
 * стенда (`formatDateTime`), и для московского пользователя выбранные сутки
 * превращались в «с 03:00 выбранного дня до 02:59 следующего». В выдачу
 * попадала ночь следующего дня, а своя собственная — нет.
 *
 * Верхняя граница — начало **следующих** суток, а не `23:59:59`: сервер
 * сравнивает полуинтервалом (`started_at < to`), и в такой паре последняя
 * секунда суток перестаёт теряться.
 *
 * @param state Состояние поиска.
 * @param timeZone Часовой пояс показа: в нём считаются границы суток.
 * @returns Параметры запроса; незаданные фильтры — `undefined`.
 */
export function toApiQuery(
  state: SearchState,
  timeZone: string = displayTimeZone(),
): Record<string, string | number | undefined> {
  return {
    // Источник уходит **всегда**, и умолчание тоже. Сервер умалчивает в NCC
    // ради старого интерфейса, но полагаться на это нельзя: запрос, который
    // не называет источник, однажды начнёт означать что-то другое, и вкладка
    // NCC молча покажет чужие звонки.
    source: state.source,
    q: state.q.trim() || undefined,
    // «За всё время» называется явно. Пустые границы для этого не годятся:
    // сервер обязан иметь умолчание в тридцать дней, иначе запрос без
    // параметров пройдёт по всему архиву, — и отсутствие границ уже занято
    // этим умолчанием. Кнопка, снимавшая период только у себя, нажималась и
    // ничего не меняла.
    period: state.allTime ? 'all' : undefined,
    from: state.from ? dayStartInstant(state.from, timeZone) : undefined,
    to: state.to ? dayStartInstant(nextDay(state.to), timeZone) : undefined,
    operator_id: state.operatorId || undefined,
    project_id: state.projectId || undefined,
    node_id: state.nodeId || undefined,
    segment: state.segment || undefined,
    product: state.product || undefined,
    page: state.page,
  };
}

/**
 * Собирает параметры KPI и «Основных тем» — срез выдачи: тот же период и тот же источник, без
 * поиска и фильтров (SRC-07, SRC-08).
 *
 * Отдельной функцией, а не выборкой на месте: подмножество собиралось руками,
 * и источник в нём забыть проще всего — KPI вкладки Телфина тогда считались бы
 * по NCC над списком Телфина.
 *
 * @param state Состояние поиска.
 * @param timeZone Часовой пояс показа; по умолчанию — пояс стенда.
 * @returns Период и источник из параметров поиска, без запроса и фильтров.
 */
export function statsQuery(
  state: SearchState,
  timeZone?: string,
): Pick<ReturnType<typeof toApiQuery>, 'from' | 'to' | 'period' | 'source'> {
  const { from, to, period, source } = toApiQuery(state, timeZone);
  return { from, to, period, source };
}

/**
 * Собирает параметры выгрузки списка (SRC-09): та же выдача, что на экране, без номера страницы —
 * выгружается всё найденное, а не догруженные страницы.
 *
 * Отдельной функцией по той же причине, что `statsQuery`: сервер без `source`
 * умалчивает в NCC (S-35), и выгрузка со вкладки Телфина, потерявшая источник
 * при сборке адреса, молча принесла бы файл звонков NCC.
 *
 * @param state Состояние поиска.
 * @param timeZone Часовой пояс показа; по умолчанию — пояс стенда.
 * @returns Параметры адреса выгрузки: те же, что у выдачи, без номера страницы.
 */
export function exportQuery(state: SearchState, timeZone?: string): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(toApiQuery(state, timeZone))) {
    if (value !== undefined && key !== 'page') params.set(key, String(value));
  }
  return params;
}

/**
 * Переключает состояние поиска на другую вкладку источника (S-35).
 *
 * Оператор и очередь сбрасываются: у каждого источника свои, и выбранный в NCC
 * оператор во вкладке Телфина дал бы пустую выдачу без объяснений. Запрос,
 * период, классификация, сегмент и продукт остаются — они значат одно и то же
 * в обоих источниках. Страница — первая: список другой.
 *
 * @param state Состояние поиска.
 * @param source Источник выбранной вкладки.
 * @returns Новое состояние; то же самое, если источник не изменился.
 */
export function switchSource(state: SearchState, source: CallSource): SearchState {
  if (state.source === source) return state;
  return { ...state, source, operatorId: '', projectId: '', page: 1 };
}

export type SearchMode = 'phrase' | 'any_order' | 'browse';

/**
 * Определяет режим поиска по набранному запросу — подпись режима, пока пользователь печатает
 * (SRC-01).
 *
 * Повторяет правило `parse_mode` на сервере, и это признанное дублирование:
 * подпись описывает то, что **произойдёт**, поэтому нужна до первого запроса.
 * Как только ответ пришёл, показывается режим из ответа — сервер главный.
 * Оба правила закрыты одинаковыми наборами примеров в тестах.
 *
 * @param query Запрос, как его набрал пользователь.
 * @returns `browse` — запроса нет, `phrase` — есть кавычки, `any_order` — слова без кавычек.
 */
export function queryMode(query: string): SearchMode {
  const stripped = query.trim();
  if (!stripped) return 'browse';
  return stripped.includes('"') ? 'phrase' : 'any_order';
}

export const MODE_LABEL: Record<SearchMode, string> = {
  phrase: 'точная фраза',
  any_order: 'слова в любом порядке',
  browse: 'все разговоры за период',
};

/**
 * Ставит или снимает фильтр по ветке классификатора.
 *
 * Тема из «Основных тем» — фильтр по ветке классификатора, а не поиск её
 * названия (SP-507, с SP-310 — узел дерева).
 *
 * Поиск слова «Роуминг» находил одноимённые темы других веток и вдобавок все
 * разговоры, где роуминг просто упомянут. Повторное нажатие на ту же тему
 * фильтр снимает.
 *
 * @param state Состояние поиска.
 * @param nodeId Идентификатор узла темы.
 * @returns Новое состояние с первой страницей выдачи.
 */
export function toggleNode(state: SearchState, nodeId: string): SearchState {
  return { ...state, nodeId: state.nodeId === nodeId ? '' : nodeId, page: 1 };
}
