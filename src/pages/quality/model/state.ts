import type { StageState } from '@/entities/evaluation';
import { STAGE_STATES } from '@/entities/evaluation';
import { defaultPeriod, parseDay } from '@/shared/lib/date';

/**
 * Значение фильтра «сотрудник» для звонков без оператора.
 *
 * Отдельное слово, а не пустое поле: пустое уже значит «все сотрудники». А
 * записи из локальной выгрузки приходят без оператора, и в сводке они —
 * отдельная строка, которую надо уметь открыть.
 */
export const UNASSIGNED = 'none';

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

const KEY = /^[a-z][a-z0-9_]{0,63}$/;

const CALL_ID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Столько принимает сервер (`q` у `/api/v1/search`); длиннее — отказ `422`. */
const QUERY_LIMIT = 500;

/**
 * Пропускает ключ этапа или итога из адреса, только если он похож на ключ.
 *
 * @param value Значение параметра; `null` — параметра нет.
 * @returns Тот же ключ или пустая строка.
 */
function key(value: string | null): string {
  return value && KEY.test(value) ? value : '';
}

/**
 * Разбирает состояние экрана из адресной строки.
 *
 * Чужое значение — не значение: сутки из адреса уходят в `dayStartInstant`, и `2026-13-45` уронило
 * бы экран целиком вместо того, чтобы показать период по умолчанию.
 *
 * @param params Параметры адреса.
 * @param now Текущий момент: от него отсчитывается период по умолчанию.
 * @returns Состояние экрана; чужие значения заменены умолчаниями.
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
    from: parseDay(params.get('from')) || fallback.from,
    to: parseDay(params.get('to')) || fallback.to,
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

/**
 * Записывает состояние экрана в параметры адреса.
 *
 * @param state Состояние экрана.
 * @returns Параметры адреса без пустых значений и умолчаний.
 */
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

/**
 * Проверяет, сужен ли список звонков отбором.
 *
 * @param state Состояние экрана.
 * @returns `true`, если задан разряд, этап, итог, нарушения, «вне скрипта» или состояние оценки.
 */
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

/**
 * Снимает отбор списка звонков.
 *
 * @param state Состояние экрана.
 * @returns Состояние с тем же охватом и порядком, без отбора.
 */
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
