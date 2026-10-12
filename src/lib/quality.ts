import type {
  CallSource,
  QualityObjectionShare,
  QualityOperatorScore,
  QualityOutcomeShare,
  QualitySummaryResponse,
} from '@/api/client';
import { formatCount } from '@/lib/format';
import {
  dayStartInstant,
  defaultPeriod,
  EMPTY_STATE,
  nextDay,
  type SearchState,
} from '@/lib/search-params';

/**
 * Значение фильтра «сотрудник» для звонков без оператора.
 *
 * Отдельное слово, а не пустое поле: пустое уже значит «все сотрудники». А
 * записи из локальной выгрузки приходят без оператора, и в сводке они —
 * отдельная строка, которую надо уметь открыть.
 */
export const UNASSIGNED = 'none';

/** Причина отказа оценки отдельно от звонков, к которым скрипт не применим. */
export function qualityFailureMessage(detail: string): string | undefined {
  if (detail === 'quality_roles_undetermined') {
    return 'Не удалось оценить звонок: роли оператора и клиента не определены.';
  }
  if (detail === 'quality_invalid_evaluation') {
    return 'Не удалось оценить звонок: ответ модели не прошёл проверку.';
  }
  if (detail === 'quality_model_error') {
    return 'Не удалось оценить звонок: модель не ответила.';
  }
  if (detail.startsWith('quality_')) return 'Не удалось оценить звонок.';
  return undefined;
}

/** Разряд звонка по баллу. Пороги считает сервер (`QualityBuckets`). */
export type Bucket = 'good' | 'fair' | 'poor';

/** Порядок на экране — от худших: открывают экран, чтобы найти, что чинить. */
export const BUCKETS: readonly Bucket[] = ['poor', 'fair', 'good'];

export const BUCKET_LABEL: Record<Bucket, string> = {
  poor: 'Плохие',
  fair: 'Средние',
  good: 'Хорошие',
};

export const BUCKET_RANGE: Record<Bucket, string> = {
  poor: 'балл ниже 70%',
  fair: 'балл 70–84%',
  good: 'балл от 85%',
};

export type CallSort = 'worst' | 'best' | 'newest';

export const SORTS: readonly CallSort[] = ['worst', 'best', 'newest'];

export const SORT_LABEL: Record<CallSort, string> = {
  worst: 'сначала худшие',
  best: 'сначала лучшие',
  newest: 'сначала свежие',
};

/**
 * Состояние экрана, целиком живёт в адресе.
 *
 * Две части. Охват — период и сотрудник: по нему считается вся сводка. Отбор —
 * разряд, этап, итог, нарушения: он сужает только список звонков, а сводка
 * остаётся на месте, иначе клик по «Плохие» менял бы числа, по которым кликнули.
 */
export type QualityState = {
  /** Сутки периода в виде `YYYY-MM-DD`. */
  from: string;
  to: string;
  operator: string;
  bucket: Bucket | '';
  /** Ключ этапа: звонки, где этап был в состоянии `stageResult`. */
  stage: string;
  /**
   * Каким этап был в звонке. По умолчанию — не выполнен: ищут обычно ошибки. Но
   * тот же этап открывают и с другой стороны — посмотреть, как его делают хорошо.
   */
  stageResult: StageState;
  outcome: string;
  /** Только звонки с невыполненным обязательным условием. */
  violations: boolean;
  /** Звонки вне скрипта вместо оценённых. С остальным отбором не сочетается. */
  skipped: boolean;
  evaluationStatus: '' | 'failed' | 'pending';
  sort: CallSort;
  /** Открытый в разборе звонок. */
  call: string;
  /** Запрос блока «Поиск по словам». */
  q: string;
  /** Разговор, открытый в панели поиска, и секунда, с которой он открыт. */
  hit: string;
  hitAt: number;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const KEY = /^[a-z][a-z0-9_]{0,63}$/;
const CALL_ID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
/** Столько принимает сервер (`q` у `/api/v1/search`); длиннее — отказ `422`. */
const QUERY_LIMIT = 500;

function day(value: string | null): string {
  return value && DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : '';
}

function key(value: string | null): string {
  return value && KEY.test(value) ? value : '';
}

/**
 * Состояние экрана из адреса. Чужое значение — не значение: сутки из адреса
 * уходят в `dayStartInstant`, и `2026-13-45` уронило бы экран целиком вместо
 * того, чтобы показать период по умолчанию.
 */
export function parseQualityState(params: URLSearchParams, now: Date): QualityState {
  const fallback = defaultPeriod(now);
  const bucket = params.get('bucket');
  const sort = params.get('sort');
  const skipped = params.get('skipped') === '1';
  const status = params.get('status');
  const evaluationStatus = status === 'failed' || status === 'pending' ? status : '';
  const unscored = skipped || !!evaluationStatus;
  const call = params.get('call') ?? '';
  const hit = params.get('hit') ?? '';
  const hitAt = Number.parseInt(params.get('t') ?? '', 10);
  const stage = unscored ? '' : key(params.get('stage'));
  const result = params.get('result');
  return {
    from: day(params.get('from')) || fallback.from,
    to: day(params.get('to')) || fallback.to,
    operator: params.get('operator') ?? '',
    // Вне скрипта нет ни баллов, ни этапов: отбор по ним дал бы пустой список,
    // и причина пустоты осталась бы в адресе, а не на экране.
    bucket: !unscored && BUCKETS.includes(bucket as Bucket) ? (bucket as Bucket) : '',
    stage,
    stageResult:
      stage && STAGE_STATES.includes(result as StageState) ? (result as StageState) : 'failed',
    outcome: unscored ? '' : key(params.get('outcome')),
    violations: !unscored && params.get('violations') === '1',
    skipped: skipped && !evaluationStatus,
    evaluationStatus,
    sort: SORTS.includes(sort as CallSort) ? (sort as CallSort) : 'worst',
    call: CALL_ID.test(call) ? call : '',
    q: (params.get('q') ?? '').slice(0, QUERY_LIMIT),
    hit: CALL_ID.test(hit) ? hit : '',
    hitAt: CALL_ID.test(hit) && hitAt > 0 ? hitAt : 0,
  };
}

export function toQualityParams(state: QualityState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.from) params.set('from', state.from);
  if (state.to) params.set('to', state.to);
  if (state.operator) params.set('operator', state.operator);
  if (state.bucket) params.set('bucket', state.bucket);
  if (state.stage) params.set('stage', state.stage);
  if (state.stage && state.stageResult !== 'failed') params.set('result', state.stageResult);
  if (state.outcome) params.set('outcome', state.outcome);
  if (state.violations) params.set('violations', '1');
  if (state.skipped) params.set('skipped', '1');
  if (state.evaluationStatus) params.set('status', state.evaluationStatus);
  if (state.sort !== 'worst') params.set('sort', state.sort);
  if (state.call) params.set('call', state.call);
  if (state.q.trim()) params.set('q', state.q.trim());
  if (state.hit) params.set('hit', state.hit);
  if (state.hit && state.hitAt > 0) params.set('t', String(state.hitAt));
  return params;
}

type ApiQuery = Record<string, string | boolean | undefined>;

/**
 * Охват сводки: период и сотрудник.
 *
 * Границы — начало суток в зоне показа, верхняя — начало **следующих** суток:
 * так же, как у поиска, иначе один и тот же день на двух экранах значил бы
 * разные звонки.
 */
export function scopeQuery(
  state: Pick<QualityState, 'from' | 'to' | 'operator'>,
  timeZone: string,
): ApiQuery {
  return {
    from: state.from ? dayStartInstant(state.from, timeZone) : undefined,
    to: state.to ? dayStartInstant(nextDay(state.to), timeZone) : undefined,
    operator_id: state.operator && state.operator !== UNASSIGNED ? state.operator : undefined,
    unassigned: state.operator === UNASSIGNED ? true : undefined,
  };
}

/** Запрос списка звонков: охват плюс отбор и порядок. */
export function callsQuery(state: QualityState, timeZone: string): ApiQuery {
  const scope = scopeQuery(state, timeZone);
  if (state.evaluationStatus) {
    return { ...scope, evaluation_status: state.evaluationStatus, sort: 'newest' };
  }
  // У звонков вне скрипта балла нет — упорядочить их можно только по времени.
  if (state.skipped) return { ...scope, applies: false, sort: 'newest' };
  return {
    ...scope,
    bucket: state.bucket || undefined,
    stage: state.stage || undefined,
    stage_state: state.stage ? state.stageResult : undefined,
    outcome: state.outcome || undefined,
    violations: state.violations ? true : undefined,
    sort: state.sort,
  };
}

/**
 * Чьи звонки оцениваются по скрипту. Совпадает с источником скрипта на сервере
 * (`CallScript.source`): поиск на экране оценки идёт по тем же звонкам, что и
 * сводка, иначе в выдаче стояли бы разговоры, которым балл не положен.
 */
export const QUALITY_SOURCE: CallSource = 'telphin';

/**
 * Запрос блока «Поиск по словам» в форме поиска диалогов: те же слова, тот же
 * охват, что у сводки, — период и сотрудник.
 *
 * `null` — искать нельзя: у поиска нет отбора «без оператора», а выдача по
 * всем сотрудникам под фильтром «Без оператора» была бы чужой.
 */
export function qualitySearch(
  state: Pick<QualityState, 'q' | 'from' | 'to' | 'operator'>,
): SearchState | null {
  if (state.operator === UNASSIGNED) return null;
  return {
    ...EMPTY_STATE,
    source: QUALITY_SOURCE,
    q: state.q,
    from: state.from,
    to: state.to,
    operatorId: state.operator,
  };
}

/** Сужен ли список звонков отбором. */
export function hasListFilter(state: QualityState): boolean {
  return Boolean(
    state.bucket ||
      state.stage ||
      state.outcome ||
      state.violations ||
      state.skipped ||
      state.evaluationStatus,
  );
}

export function clearListFilter(state: QualityState): QualityState {
  return {
    ...state,
    bucket: '',
    stage: '',
    stageResult: 'failed',
    outcome: '',
    violations: false,
    skipped: false,
    evaluationStatus: '',
  };
}

/**
 * Сутки `YYYY-MM-DD` как `ДД.ММ.ГГГГ` — без перевода через `Date`. Неделя и
 * границы периода — это сутки, а не момент: переведённые через пояс, они
 * съезжали бы на предыдущий день у всякого, кто западнее Гринвича.
 */
export function formatDay(value: string): string {
  const [year, month, date] = value.split('-');
  return year && month && date ? `${date}.${month}.${year}` : value;
}

/** Доля 0–1 процентами, целым числом. */
export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export type Period = { from: string; to: string };

function shiftDay(day: string, days: number): string {
  const moment = new Date(`${day}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
}

/**
 * Неделя столбца в пределах выбранного периода: с понедельника по воскресенье.
 *
 * Крайние столбцы периода неполные — сервер считает в них только звонки
 * периода. Клик по столбцу ставит период на ту же часть недели: возьми он
 * неделю целиком, число после клика разошлось бы с числом на столбце.
 */
export function weekPeriod(weekStart: string, within: Period): Period {
  const end = shiftDay(weekStart, 6);
  return {
    from: weekStart < within.from ? within.from : weekStart,
    to: end > within.to ? within.to : end,
  };
}

/**
 * Новая граница периода из календаря. Период не переворачивается: если начало
 * выбрано позже конца, конец встаёт на ту же дату, и наоборот — правило макета.
 */
export function movePeriod(period: Period, edge: 'from' | 'to', day: string): Period {
  if (edge === 'from') return { from: day, to: day > period.to ? day : period.to };
  return { from: day < period.from ? day : period.from, to: day };
}

/** Подпись столбца недели: `14.09–20.09`, одни сутки — `14.09`. */
export function periodLabel(period: Period): string {
  const from = formatDay(period.from).slice(0, 5);
  const to = formatDay(period.to).slice(0, 5);
  return from === to ? from : `${from}–${to}`;
}

/**
 * Предыдущий период той же длины, вплотную к выбранному: неделя перед неделей,
 * тридцать дней перед тридцатью. С ним сравнивается балл сотрудника.
 */
export function previousPeriod(period: Period): Period {
  const span = Date.parse(`${period.to}T00:00:00Z`) - Date.parse(`${period.from}T00:00:00Z`);
  const days = Math.max(1, Math.round(span / 86_400_000) + 1);
  const to = shiftDay(period.from, -1);
  return { from: shiftDay(to, 1 - days), to };
}

export type Trend = 'up' | 'flat' | 'down';

/**
 * На сколько пунктов должен измениться средний балл, чтобы это считалось
 * движением. Меньше — «стабильно»: у сотрудника с десятком звонков один
 * разговор сдвигает средний балл на пару пунктов и без всякой динамики.
 *
 * В макете заказчика правила нет, там выдуманные данные. Порог наш.
 */
export const TREND_THRESHOLD = 3;

/**
 * Динамика балла к предыдущему периоду. `null` — сравнивать не с чем: в
 * предыдущем периоде у сотрудника не было оценённых звонков.
 */
export function trendOf(current: number, previous: number | undefined): Trend | null {
  if (previous === undefined) return null;
  const delta = current - previous;
  if (delta > TREND_THRESHOLD) return 'up';
  if (delta < -TREND_THRESHOLD) return 'down';
  return 'flat';
}

export const TREND_LABEL: Record<Trend, string> = {
  up: '↑ растёт',
  flat: '→ стабильно',
  down: '↓ снижается',
};

export type ScoreTone = 'good' | 'fair' | 'poor';

/** Цвет процента: те же пороги, что у разрядов звонков, — 85 и 70. */
export function scoreTone(score: number): ScoreTone {
  if (score >= 85) return 'good';
  if (score >= 70) return 'fair';
  return 'poor';
}

export type StageState = 'done' | 'failed' | 'skipped';

/** Порядок в переключателе над списком: сначала то, ради чего обычно приходят. */
export const STAGE_STATES: readonly StageState[] = ['failed', 'done', 'skipped'];

/** Этап в одном звонке: выполнен, не выполнен или не понадобился. */
export function stageState(stage: { applicable: boolean; passed: boolean }): StageState {
  if (!stage.applicable) return 'skipped';
  return stage.passed ? 'done' : 'failed';
}

export const STAGE_STATE_LABEL: Record<StageState, string> = {
  done: 'выполнен',
  failed: 'не выполнен',
  skipped: 'не понадобился',
};

/**
 * Этап за период тремя числами. Не понадобившийся этап засчитан в балл звонка
 * (правило заказчика), но выполненным он от этого не становится — здесь они
 * разведены.
 */
export function stageCounts(stage: { calls: number; applicable: number; failed: number }): {
  done: number;
  failed: number;
  skipped: number;
} {
  return {
    done: Math.max(0, stage.applicable - stage.failed),
    failed: stage.failed,
    skipped: Math.max(0, stage.calls - stage.applicable),
  };
}

/**
 * Доля выполнения этапа там, где он был нужен. `null` — не был нужен ни разу:
 * это не 0% и не 100%, и показывать его числом значило бы выдумать оценку.
 */
export function doneShare(applicable: number, failed: number): number | null {
  if (applicable <= 0) return null;
  return Math.max(0, applicable - failed) / applicable;
}

type StageLike = { label: string; applicable: number; failed: number };

/**
 * Этап, который чаще всего не выполняют там, где он нужен. При равной доле —
 * тот, где невыполненных больше: «два из четырёх» весомее, чем «один из двух».
 * Дальше — раньший по скрипту: этапы идут в порядке разговора, и провал в
 * начале объясняет провалы после него. `null` — невыполненных нет.
 */
export function weakestStage<T extends StageLike>(stages: readonly T[]): T | null {
  let weakest: T | null = null;
  let lowest = 1;
  for (const stage of stages) {
    const share = doneShare(stage.applicable, stage.failed);
    if (share === null || stage.failed === 0) continue;
    if (weakest === null || share < lowest || (share === lowest && stage.failed > weakest.failed)) {
      weakest = stage;
      lowest = share;
    }
  }
  return weakest;
}

export function operatorLabel(operator: Pick<QualityOperatorScore, 'full_name' | 'login'>): string {
  return operator.full_name || operator.login || 'Без оператора';
}

/** Ключ сотрудника для фильтра: звонки без оператора — `UNASSIGNED`. */
export function operatorKey(operator: Pick<QualityOperatorScore, 'operator_id'>): string {
  return operator.operator_id ?? UNASSIGNED;
}

/**
 * Карточки возражений из макета заказчика: шесть типов, по которым он смотрит
 * отработку. В скрипте («РСВ») типов больше: «подумаю» там в двух вариантах —
 * с проверенной технической возможностью и без, — и это одна карточка.
 */
const OBJECTION_CARDS: readonly { key: string; label: string; types: readonly string[] }[] = [
  { key: 'not_interested', label: 'Не интересно', types: ['not_interested'] },
  { key: 'has_everything', label: 'У меня всё есть / всё устраивает', types: ['has_everything'] },
  { key: 'cheaper', label: 'Мой тариф/провайдер выгоднее', types: ['cheaper'] },
  {
    key: 'think',
    label: 'Надо подумать / посоветоваться',
    types: ['think_checked', 'think_unchecked'],
  },
  { key: 'self_service', label: 'Сам обращусь в офис / на сайте', types: ['self_service'] },
  { key: 'bad_mobile', label: 'Жалоба на плохую связь', types: ['bad_mobile'] },
];

/** Ключ карточки для возражений, которых в макете нет. */
export const OTHER_OBJECTIONS = 'other';

export type ObjectionCard = {
  key: string;
  label: string;
  raised: number;
  handled: number;
  /** Доля отработанных. `null` — возражение не звучало: это не 0% и не 100%. */
  share: number | null;
  /** Из чего сложена карточка «Прочие»: только то, что звучало. */
  parts: readonly { type: string; label: string; raised: number; handled: number }[];
};

/**
 * Возражения периода карточками макета. Последняя — «Прочие»: всё, чего в
 * шести карточках нет. Так тип, добавленный в скрипт позже, не пропадает с
 * экрана молча, а сумма карточек равна числу возражений периода.
 */
export function objectionCards(objections: readonly QualityObjectionShare[]): ObjectionCard[] {
  const byType = new Map(objections.map((item) => [item.type, item]));
  const named = new Set(OBJECTION_CARDS.flatMap((card) => card.types));
  const sum = (items: readonly QualityObjectionShare[]) => {
    const raised = items.reduce((total, item) => total + item.raised, 0);
    const handled = items.reduce((total, item) => total + item.handled, 0);
    return { raised, handled, share: raised > 0 ? handled / raised : null };
  };
  const cards: ObjectionCard[] = OBJECTION_CARDS.map((card) => ({
    key: card.key,
    label: card.label,
    ...sum(card.types.flatMap((type) => byType.get(type) ?? [])),
    parts: [],
  }));
  const rest = objections.filter((item) => !named.has(item.type));
  cards.push({
    key: OTHER_OBJECTIONS,
    label: 'Прочие',
    ...sum(rest),
    parts: rest
      .filter((item) => item.raised > 0)
      .map(({ type, label, raised, handled }) => ({ type, label, raised, handled })),
  });
  return cards;
}

/** Итоги на круговой диаграмме макета, по часовой стрелке. */
export const DONUT_OUTCOMES = ['request', 'callback', 'refusal'] as const;

export type DonutOutcome = (typeof DONUT_OUTCOMES)[number];

export type OutcomeDonut = {
  /** Три части диаграммы: доля от звонков по скрипту и смещение начала дуги. */
  parts: readonly (QualityOutcomeShare & { key: DonutOutcome; offset: number })[];
  /** Итоги, которых на диаграмме нет: «нет технической возможности», «не определено». */
  rest: readonly QualityOutcomeShare[];
};

/**
 * Итоги звонков для диаграммы. Доли — от всех звонков по скрипту, а не от трёх
 * показанных: иначе «заявок 50%» на диаграмме расходилось бы с числом звонков
 * в списке, и остаток круга честно остаётся пустым.
 */
export function outcomeDonut(outcomes: readonly QualityOutcomeShare[]): OutcomeDonut {
  const byKey = new Map(outcomes.map((item) => [item.key, item]));
  let offset = 0;
  const parts = DONUT_OUTCOMES.flatMap((key) => {
    const found = byKey.get(key);
    if (!found) return [];
    const part = { ...found, key, offset };
    offset += found.share;
    return [part];
  });
  const shown = new Set<string>(DONUT_OUTCOMES);
  return { parts, rest: outcomes.filter((item) => !shown.has(item.key)) };
}

/**
 * Картина периода одной фразой.
 *
 * Считается здесь из тех же чисел, что на экране, а не пишется моделью: итог,
 * расходящийся с графиком под ним, хуже его отсутствия.
 */
export function headline(summary: QualitySummaryResponse): string {
  const calls = summary.calls;
  if (!calls) return 'За период нет звонков, оценённых по скрипту.';
  const { poor, good } = summary.buckets;
  const sentences = [
    `Из ${formatCount(calls, 'звонка', 'звонков', 'звонков')} по скрипту ` +
      `плохих — ${poor}, хороших — ${good}.`,
  ];
  const stage = weakestStage(summary.stages ?? []);
  sentences.push(
    stage
      ? `Чаще всего не выполняют этап «${stage.label}»: ${stage.failed} из ` +
          `${formatCount(stage.applicable, 'звонка', 'звонков', 'звонков')}, где он был нужен.`
      : 'Все этапы выполнены везде, где были нужны.',
  );
  if (summary.violations > 0) {
    sentences.push(
      `Обязательное условие не выполнено в ${formatCount(
        summary.violations,
        'звонке',
        'звонках',
        'звонках',
      )}.`,
    );
  }
  return sentences.join(' ');
}
