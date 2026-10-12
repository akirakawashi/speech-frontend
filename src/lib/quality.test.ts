import { describe, expect, it } from 'vitest';
import type { QualitySummaryResponse } from '@/api/client';
import {
  callsQuery,
  clearListFilter,
  doneShare,
  formatDay,
  hasListFilter,
  headline,
  movePeriod,
  objectionCards,
  operatorKey,
  operatorLabel,
  outcomeDonut,
  parseQualityState,
  percent,
  periodLabel,
  previousPeriod,
  type QualityState,
  qualitySearch,
  scopeQuery,
  scoreTone,
  stageCounts,
  stageState,
  TREND_THRESHOLD,
  toQualityParams,
  trendOf,
  UNASSIGNED,
  weakestStage,
  weekPeriod,
} from '@/lib/quality';

const NOW = new Date('2026-10-05T09:00:00Z');
const CALL = '0b0e15aa-1111-4222-8333-444455556666';

function state(patch: Partial<QualityState> = {}): QualityState {
  return {
    from: '2026-09-14',
    to: '2026-09-20',
    operator: '',
    bucket: '',
    stage: '',
    stageResult: 'failed',
    outcome: '',
    violations: false,
    skipped: false,
    evaluationStatus: '',
    sort: 'worst',
    call: '',
    q: '',
    hit: '',
    hitAt: 0,
    ...patch,
  };
}

function stage(label: string, applicable: number, failed: number) {
  return {
    key: label,
    label,
    mandatory: false,
    calls: 4,
    applicable,
    passed: 4 - failed,
    failed,
    share: (4 - failed) / 4,
  };
}

function summary(patch: Partial<QualitySummaryResponse> = {}): QualitySummaryResponse {
  return {
    contract_version: '2.1',
    script_version: 'volna-outbound-2026-04-01',
    total: 4,
    failed: 0,
    pending: 0,
    unavailable: 0,
    evaluated: 4,
    calls: 4,
    fully_correct: 2,
    fully_correct_share: 0.5,
    average_score: 70,
    buckets: { good: 2, fair: 1, poor: 1 },
    violations: 0,
    stages: [stage('Приветствие', 4, 1), stage('Презентация продукта', 4, 2)],
    objections: [],
    outcomes: [],
    operators: [],
    weeks: [],
    ...patch,
  };
}

describe('состояние экрана в адресе', () => {
  it('без параметров — последние тридцать дней и худшие сверху', () => {
    expect(parseQualityState(new URLSearchParams(''), NOW)).toEqual(
      state({ from: '2026-09-05', to: '2026-10-05' }),
    );
  });

  it('адрес восстанавливает период, отбор и открытый звонок', () => {
    const full = state({
      operator: UNASSIGNED,
      bucket: 'poor',
      stage: 'passport',
      stageResult: 'done',
      outcome: 'callback',
      violations: true,
      sort: 'newest',
      call: CALL,
    });
    expect(parseQualityState(toQualityParams(full), NOW)).toEqual(full);
  });

  it('состояние этапа без самого этапа ничего не значит', () => {
    expect(parseQualityState(new URLSearchParams('result=done'), NOW).stageResult).toBe('failed');
    const params = new URLSearchParams('stage=passport&result=maybe');
    expect(parseQualityState(params, NOW).stageResult).toBe('failed');
    // «Не выполнен» — умолчание, и в адрес оно не пишется.
    expect(toQualityParams(state({ stage: 'passport' })).has('result')).toBe(false);
  });

  it('умолчания в адрес не пишутся', () => {
    expect(toQualityParams(state()).toString()).toBe('from=2026-09-14&to=2026-09-20');
  });

  it('чужие значения — не значения', () => {
    const params = new URLSearchParams({
      from: '2026-13-45',
      bucket: 'bad',
      stage: 'DROP TABLE',
      outcome: 'Отказ',
      sort: 'random',
      call: '123',
    });
    expect(parseQualityState(params, NOW)).toEqual(state({ from: '2026-09-05', to: '2026-10-05' }));
  });

  it('у звонков вне скрипта отбора по баллу и этапу нет', () => {
    const params = new URLSearchParams('skipped=1&bucket=poor&stage=passport&violations=1');
    const parsed = parseQualityState(params, NOW);
    expect(parsed.skipped).toBe(true);
    expect([parsed.bucket, parsed.stage, parsed.violations]).toEqual(['', '', false]);
  });

  it('ошибки оценки сохраняются в адресе и снимают отбор по баллам', () => {
    const parsed = parseQualityState(
      new URLSearchParams('status=failed&skipped=1&bucket=poor&stage=passport&violations=1'),
      NOW,
    );
    expect(parsed.evaluationStatus).toBe('failed');
    expect([parsed.skipped, parsed.bucket, parsed.stage, parsed.violations]).toEqual([
      false,
      '',
      '',
      false,
    ]);
    expect(parseQualityState(toQualityParams(parsed), NOW)).toEqual(parsed);
    expect(parseQualityState(new URLSearchParams('status=garbage'), NOW).evaluationStatus).toBe('');
  });
});

describe('запросы к API', () => {
  it('сутки периода — по часам колл-центра, верхняя граница — следующие сутки', () => {
    expect(scopeQuery(state(), 'Europe/Moscow')).toEqual({
      from: '2026-09-13T21:00:00.000Z',
      to: '2026-09-20T21:00:00.000Z',
      operator_id: undefined,
      unassigned: undefined,
    });
  });

  it('сотрудник и «без оператора» — разные параметры', () => {
    expect(scopeQuery(state({ operator: 'op-1' }), 'UTC').operator_id).toBe('op-1');
    const unassigned = scopeQuery(state({ operator: UNASSIGNED }), 'UTC');
    expect([unassigned.operator_id, unassigned.unassigned]).toEqual([undefined, true]);
  });

  it('список получает отбор и порядок поверх охвата', () => {
    const query = callsQuery(
      state({ operator: 'op-1', bucket: 'poor', stage: 'needs', violations: true }),
      'UTC',
    );
    expect(query).toMatchObject({
      operator_id: 'op-1',
      bucket: 'poor',
      stage: 'needs',
      stage_state: 'failed',
      outcome: undefined,
      violations: true,
      sort: 'worst',
    });
  });

  it('этап смотрят и там, где он выполнен; без этапа состояние не уходит', () => {
    const done = callsQuery(state({ stage: 'needs', stageResult: 'done' }), 'UTC');
    expect([done.stage, done.stage_state]).toEqual(['needs', 'done']);
    expect(callsQuery(state(), 'UTC').stage_state).toBeUndefined();
  });

  it('звонки вне скрипта идут по времени: балла у них нет', () => {
    const query = callsQuery(state({ skipped: true, sort: 'best' }), 'UTC');
    expect([query.applies, query.sort, query.bucket]).toEqual([false, 'newest', undefined]);
  });

  it('по умолчанию видны все записи, ошибки и ожидающие оценки выбираются отдельно', () => {
    expect(callsQuery(state(), 'UTC').applies).toBeUndefined();
    const failed = state({ evaluationStatus: 'failed', bucket: 'poor', stage: 'needs' });
    expect(callsQuery(failed, 'UTC')).toMatchObject({
      evaluation_status: 'failed',
      sort: 'newest',
    });
    expect(callsQuery(failed, 'UTC').bucket).toBeUndefined();
    expect(callsQuery(state({ evaluationStatus: 'pending' }), 'UTC').evaluation_status).toBe(
      'pending',
    );
    expect(hasListFilter(failed)).toBe(true);
    expect(clearListFilter(failed).evaluationStatus).toBe('');
  });

  it('отбор списка снимается разом, охват остаётся', () => {
    const filtered = state({ operator: 'op-1', bucket: 'good', outcome: 'request', call: CALL });
    expect(hasListFilter(filtered)).toBe(true);
    expect(clearListFilter(filtered)).toEqual(state({ operator: 'op-1', call: CALL }));
    expect(hasListFilter(state({ operator: 'op-1' }))).toBe(false);
  });
});

describe('этапы', () => {
  it('этап в звонке: выполнен, не выполнен или не понадобился', () => {
    expect(stageState({ applicable: true, passed: true })).toBe('done');
    expect(stageState({ applicable: true, passed: false })).toBe('failed');
    // Не понадобившийся этап засчитан сервером, но выполненным не считается.
    expect(stageState({ applicable: false, passed: true })).toBe('skipped');
  });

  it('этап за период раскладывается на три числа', () => {
    expect(stageCounts({ calls: 4, applicable: 2, failed: 1 })).toEqual({
      done: 1,
      failed: 1,
      skipped: 2,
    });
  });

  it('выполнение считается от звонков, где этап был нужен', () => {
    expect(doneShare(2, 1)).toBe(0.5);
    expect(doneShare(4, 0)).toBe(1);
    // Ни разу не был нужен — это не 0% и не 100%.
    expect(doneShare(0, 0)).toBeNull();
  });

  it('слабый этап — с наименьшим выполнением', () => {
    const stages = [stage('a', 4, 1), stage('b', 2, 1), stage('c', 4, 2), stage('d', 0, 0)];
    // У `b` и `c` поровну — половина, но у `c` невыполненных больше.
    expect(weakestStage(stages)?.label).toBe('c');
    // При полном равенстве — раньший по скрипту.
    expect(weakestStage([stage('x', 2, 1), stage('y', 2, 1)])?.label).toBe('x');
    expect(weakestStage([stage('a', 4, 0), stage('d', 0, 0)])).toBeNull();
  });
});

describe('картина периода словами', () => {
  it('называет разряды и слабый этап', () => {
    expect(headline(summary())).toBe(
      'Из 4 звонков по скрипту плохих — 1, хороших — 2. Чаще всего не выполняют этап ' +
        '«Презентация продукта»: 2 из 4 звонков, где он был нужен.',
    );
  });

  it('без невыполненных этапов так и говорит', () => {
    const clean = summary({
      calls: 1,
      buckets: { good: 1, fair: 0, poor: 0 },
      stages: [stage('Приветствие', 1, 0)],
    });
    expect(headline(clean)).toBe(
      'Из 1 звонка по скрипту плохих — 0, хороших — 1. Все этапы выполнены везде, где были нужны.',
    );
  });

  it('нарушения обязательных условий названы отдельно', () => {
    expect(headline(summary({ violations: 2 }))).toContain(
      'Обязательное условие не выполнено в 2 звонках.',
    );
  });

  it('пустой период — не «0 из 0»', () => {
    expect(headline(summary({ calls: 0 }))).toBe('За период нет звонков, оценённых по скрипту.');
  });
});

describe('подписи', () => {
  it('цвет процента — по порогам 85 и 70', () => {
    expect([scoreTone(85), scoreTone(84), scoreTone(70), scoreTone(69)]).toEqual([
      'good',
      'fair',
      'fair',
      'poor',
    ]);
  });

  it('доля и сутки', () => {
    expect(percent(0.756)).toBe('76%');
    expect(formatDay('2026-09-14')).toBe('14.09.2026');
  });

  it('звонки без оператора — отдельная строка со своим ключом', () => {
    expect(operatorLabel({ full_name: 'Иванова А.', login: 'ivanova' })).toBe('Иванова А.');
    expect(operatorLabel({ full_name: null, login: null })).toBe('Без оператора');
    expect(operatorKey({ operator_id: 'op-1' })).toBe('op-1');
    expect(operatorKey({ operator_id: null })).toBe(UNASSIGNED);
  });
});

describe('недели', () => {
  const period = { from: '2026-09-10', to: '2026-09-25' };

  it('неделя — с понедельника по воскресенье', () => {
    expect(weekPeriod('2026-09-14', period)).toEqual({ from: '2026-09-14', to: '2026-09-20' });
  });

  it('крайние недели обрезаны периодом: в столбце только его звонки', () => {
    expect(weekPeriod('2026-09-07', period)).toEqual({ from: '2026-09-10', to: '2026-09-13' });
    expect(weekPeriod('2026-09-21', period)).toEqual({ from: '2026-09-21', to: '2026-09-25' });
  });

  it('неделя на стыке месяцев и годов считается по календарю', () => {
    const wide = { from: '2026-01-01', to: '2027-12-31' };
    expect(weekPeriod('2026-09-28', wide).to).toBe('2026-10-04');
    expect(weekPeriod('2026-12-28', wide).to).toBe('2027-01-03');
  });

  it('период из календаря не переворачивается: вторая граница встаёт на ту же дату', () => {
    const week = { from: '2026-09-14', to: '2026-09-20' };
    expect(movePeriod(week, 'from', '2026-09-16')).toEqual({
      from: '2026-09-16',
      to: '2026-09-20',
    });
    expect(movePeriod(week, 'from', '2026-09-25')).toEqual({
      from: '2026-09-25',
      to: '2026-09-25',
    });
    expect(movePeriod(week, 'to', '2026-09-18')).toEqual({ from: '2026-09-14', to: '2026-09-18' });
    expect(movePeriod(week, 'to', '2026-09-01')).toEqual({ from: '2026-09-01', to: '2026-09-01' });
  });

  it('подпись — сутки без года, одни сутки — одной датой', () => {
    expect(periodLabel({ from: '2026-09-14', to: '2026-09-20' })).toBe('14.09–20.09');
    expect(periodLabel({ from: '2026-09-14', to: '2026-09-14' })).toBe('14.09');
  });
});

describe('возражения карточками макета', () => {
  const item = (type: string, raised: number, handled: number) => ({
    type,
    label: `подпись ${type}`,
    raised,
    handled,
    share: raised ? handled / raised : 0,
  });

  it('шесть карточек макета и «Прочие», в порядке макета', () => {
    expect(objectionCards([]).map((card) => card.label)).toEqual([
      'Не интересно',
      'У меня всё есть / всё устраивает',
      'Мой тариф/провайдер выгоднее',
      'Надо подумать / посоветоваться',
      'Сам обращусь в офис / на сайте',
      'Жалоба на плохую связь',
      'Прочие',
    ]);
  });

  it('два «подумаю» из скрипта — одна карточка', () => {
    const cards = objectionCards([item('think_checked', 3, 1), item('think_unchecked', 1, 1)]);
    const think = cards.find((card) => card.key === 'think');
    expect([think?.raised, think?.handled, think?.share]).toEqual([4, 2, 0.5]);
  });

  it('не звучавшее возражение — без доли, а не 0%', () => {
    const cards = objectionCards([item('cheaper', 0, 0)]);
    expect(cards.find((card) => card.key === 'cheaper')?.share).toBeNull();
  });

  it('«Прочие» собирают всё, чего в макете нет, и называют то, что звучало', () => {
    const cards = objectionCards([
      item('cheaper', 2, 2),
      item('company', 2, 1),
      item('location', 0, 0),
      item('added_later', 1, 0),
    ]);
    const other = cards.at(-1);
    expect([other?.raised, other?.handled]).toEqual([3, 1]);
    expect(other?.parts.map((part) => part.type)).toEqual(['company', 'added_later']);
    // Сумма карточек — все возражения периода: ничего не пропало.
    expect(cards.reduce((sum, card) => sum + card.raised, 0)).toBe(5);
  });
});

describe('итог звонка диаграммой', () => {
  const outcome = (key: string, calls: number, share: number) => ({
    key,
    label: `подпись ${key}`,
    calls,
    share,
  });

  it('на диаграмме три итога в порядке макета, остальные — отдельно', () => {
    const donut = outcomeDonut([
      outcome('refusal', 1, 0.25),
      outcome('no_tech', 1, 0.25),
      outcome('request', 1, 0.25),
      outcome('callback', 1, 0.25),
      outcome('unknown', 0, 0),
    ]);
    expect(donut.parts.map((part) => part.key)).toEqual(['request', 'callback', 'refusal']);
    expect(donut.rest.map((item) => item.key)).toEqual(['no_tech', 'unknown']);
  });

  it('дуги идут подряд, а доля «без возможности» остаётся пустым местом круга', () => {
    const donut = outcomeDonut([
      outcome('request', 1, 0.25),
      outcome('callback', 2, 0.5),
      outcome('refusal', 0, 0),
      outcome('no_tech', 1, 0.25),
    ]);
    expect(donut.parts.map((part) => part.offset)).toEqual([0, 0.25, 0.75]);
    expect(donut.parts.reduce((sum, part) => sum + part.share, 0)).toBe(0.75);
  });
});

describe('динамика сотрудника', () => {
  it('прошлый период — той же длины и вплотную к выбранному', () => {
    expect(previousPeriod({ from: '2026-09-14', to: '2026-09-20' })).toEqual({
      from: '2026-09-07',
      to: '2026-09-13',
    });
    expect(previousPeriod({ from: '2026-09-14', to: '2026-09-14' })).toEqual({
      from: '2026-09-13',
      to: '2026-09-13',
    });
    // Через границу месяца и года — по календарю.
    expect(previousPeriod({ from: '2026-01-01', to: '2026-01-31' })).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('движение — больше порога в три пункта, иначе стабильно', () => {
    expect(TREND_THRESHOLD).toBe(3);
    expect(trendOf(80, 70)).toBe('up');
    expect(trendOf(60, 70)).toBe('down');
    expect(trendOf(73, 70)).toBe('flat');
    expect(trendOf(67, 70)).toBe('flat');
    expect(trendOf(73.5, 70)).toBe('up');
  });

  it('без прошлого периода динамики нет: это не «стабильно»', () => {
    expect(trendOf(80, undefined)).toBeNull();
  });
});

describe('поиск по словам', () => {
  it('запрос, открытый разговор и его секунда живут в адресе', () => {
    const params = toQualityParams(state({ q: ' паспорт ', hit: CALL, hitAt: 65 }));
    expect(params.get('q')).toBe('паспорт');
    expect(params.get('hit')).toBe(CALL);
    expect(params.get('t')).toBe('65');

    const parsed = parseQualityState(params, NOW);
    expect([parsed.q, parsed.hit, parsed.hitAt]).toEqual(['паспорт', CALL, 65]);
  });

  it('пустой запрос и закрытая панель адрес не занимают', () => {
    const params = toQualityParams(state({ q: '   ', hitAt: 65 }));
    expect([params.has('q'), params.has('hit'), params.has('t')]).toEqual([false, false, false]);
  });

  it('чужое значение разговора — не значение, и секунда без него тоже', () => {
    const parsed = parseQualityState(new URLSearchParams('q=связь&hit=../admin&t=30'), NOW);
    expect([parsed.q, parsed.hit, parsed.hitAt]).toEqual(['связь', '', 0]);
  });

  it('ищет среди звонков, которые оцениваются, в охвате экрана', () => {
    expect(qualitySearch(state({ q: 'паспорт', operator: 'op-1' }))).toMatchObject({
      source: 'telphin',
      q: 'паспорт',
      from: '2026-09-14',
      to: '2026-09-20',
      operatorId: 'op-1',
      allTime: false,
    });
  });

  it('среди звонков без оператора не ищет: у поиска такого отбора нет', () => {
    expect(qualitySearch(state({ q: 'паспорт', operator: UNASSIGNED }))).toBeNull();
  });
});
