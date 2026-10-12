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

import type { CallSource } from '@/api/client';
import { currentConfig } from '@/lib/config';

export const SEGMENTS = ['b2b', 'individual'] as const;
export const PRODUCTS = ['wallet', 'mobile', 'broadband'] as const;
/** Вкладки «Диалогов» (S-35), по порядку показа. Первая — умолчание. */
export const SOURCES = ['ncc', 'telphin'] as const satisfies readonly CallSource[];

export type Segment = (typeof SEGMENTS)[number];
export type Product = (typeof PRODUCTS)[number];

/**
 * Вкладка по умолчанию — входящие NCC, как и умолчание сервера: ссылки,
 * разосланные до появления Телфина, адреса без `source` и открывают то, что
 * показывали до него.
 */
export const DEFAULT_SOURCE: CallSource = 'ncc';

/** Сколько дней показывает период по умолчанию (SRC-02). */
export const DEFAULT_PERIOD_DAYS = 30;

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

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | '' {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : '';
}

/** Дата в виде `YYYY-MM-DD` — то, что понимает `<input type="date">`. */
export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Период по умолчанию считается и здесь, и на сервере, и это осознанное
 * дублирование: сервер обязан иметь умолчание, иначе запрос без параметров
 * пройдёт по всему архиву; интерфейс обязан показать человеку, какой период он
 * смотрит, а не пустые поля. Значение одно — 30 дней, и оно названо константой
 * с обеих сторон.
 */
export function defaultPeriod(now: Date): { from: string; to: string } {
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - DEFAULT_PERIOD_DAYS);
  return { from: isoDate(from), to: isoDate(now) };
}

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

/** Адрес без пустых параметров: он попадёт в переписку, и его будут читать. */
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
 * Смещение зоны показа от UTC в указанный момент, в минутах.
 *
 * Через `Intl`, а не таблицей: переход на летнее время и любые будущие правки
 * зоны приезжают с системой, а зашитое «+3» однажды разойдётся с реальностью
 * молча — сутки съедут на час, и это спишут на «странный поиск».
 */
function zoneOffsetMinutes(moment: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(moment);
  const at = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  // `hour` в формате `hour12: false` даёт 24 для полуночи в части сред.
  const asUtc = Date.UTC(
    at('year'),
    at('month') - 1,
    at('day'),
    at('hour') % 24,
    at('minute'),
    at('second'),
  );
  return (asUtc - moment.getTime()) / 60_000;
}

/**
 * Начало суток `day` в зоне показа — моментом времени.
 *
 * Два прохода: смещение зависит от момента, а момент — от смещения. Первый
 * проход берёт смещение по «наивной» полуночи, второй уточняет его уже по
 * найденному моменту, и это снимает единственный случай, где первый ошибается
 * на час, — сутки перехода на летнее время.
 */
export function dayStartInstant(day: string, timeZone: string): string {
  const naive = Date.parse(`${day}T00:00:00Z`);
  let instant = naive - zoneOffsetMinutes(new Date(naive), timeZone) * 60_000;
  instant = naive - zoneOffsetMinutes(new Date(instant), timeZone) * 60_000;
  return new Date(instant).toISOString();
}

/** Следующие сутки в виде `YYYY-MM-DD`. */
export function nextDay(day: string): string {
  const moment = new Date(`${day}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + 1);
  return isoDate(moment);
}

/**
 * Параметры запроса к API. Границы периода — моменты времени **в зоне показа**.
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
 */
export function toApiQuery(
  state: SearchState,
  timeZone: string = currentConfig().displayTimezone || 'Europe/Moscow',
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
 * Параметры KPI и «Основных тем» — срез выдачи: тот же период и тот же
 * источник, без поиска и фильтров (SRC-07, SRC-08).
 *
 * Отдельной функцией, а не выборкой на месте: подмножество собиралось руками,
 * и источник в нём забыть проще всего — KPI вкладки Телфина тогда считались бы
 * по NCC над списком Телфина.
 */
export function statsQuery(
  state: SearchState,
  timeZone?: string,
): Pick<ReturnType<typeof toApiQuery>, 'from' | 'to' | 'period' | 'source'> {
  const { from, to, period, source } = toApiQuery(state, timeZone);
  return { from, to, period, source };
}

/**
 * Параметры выгрузки списка (SRC-09): та же выдача, что на экране, без номера
 * страницы — выгружается всё найденное, а не догруженные страницы.
 *
 * Отдельной функцией по той же причине, что `statsQuery`: сервер без `source`
 * умалчивает в NCC (S-35), и выгрузка со вкладки Телфина, потерявшая источник
 * при сборке адреса, молча принесла бы файл звонков NCC.
 */
export function exportQuery(state: SearchState, timeZone?: string): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(toApiQuery(state, timeZone))) {
    if (value !== undefined && key !== 'page') params.set(key, String(value));
  }
  return params;
}

/**
 * Смена вкладки источника (S-35).
 *
 * Оператор и очередь сбрасываются: у каждого источника свои, и выбранный в NCC
 * оператор во вкладке Телфина дал бы пустую выдачу без объяснений. Запрос,
 * период, классификация, сегмент и продукт остаются — они значат одно и то же
 * в обоих источниках. Страница — первая: список другой.
 */
export function switchSource(state: SearchState, source: CallSource): SearchState {
  if (state.source === source) return state;
  return { ...state, source, operatorId: '', projectId: '', page: 1 };
}

export type SearchMode = 'phrase' | 'any_order' | 'browse';

/**
 * Подпись режима, пока пользователь печатает (SRC-01).
 *
 * Повторяет правило `parse_mode` на сервере, и это признанное дублирование:
 * подпись описывает то, что **произойдёт**, поэтому нужна до первого запроса.
 * Как только ответ пришёл, показывается режим из ответа — сервер главный.
 * Оба правила закрыты одинаковыми наборами примеров в тестах.
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
 * Тема из «Основных тем» — фильтр по ветке классификатора, а не поиск её
 * названия (SP-507, с SP-310 — узел дерева).
 *
 * Поиск слова «Роуминг» находил одноимённые темы других веток и вдобавок все
 * разговоры, где роуминг просто упомянут. Повторное нажатие на ту же тему
 * фильтр снимает.
 */
export function toggleNode(state: SearchState, nodeId: string): SearchState {
  return { ...state, nodeId: state.nodeId === nodeId ? '' : nodeId, page: 1 };
}
