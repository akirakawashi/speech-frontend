import { describe, expect, it } from 'vitest';
import {
  defaultPeriod,
  EMPTY_STATE,
  MODE_LABEL,
  parseSearchState,
  queryMode,
  statsQuery,
  switchSource,
  toApiQuery,
  toggleNode,
  toSearchParams,
} from '@/lib/search-params';

const NOW = new Date('2026-09-10T12:00:00Z');

function parse(search: string) {
  return parseSearchState(new URLSearchParams(search), NOW);
}

describe('период по умолчанию', () => {
  it('последние 30 дней (SRC-02)', () => {
    expect(defaultPeriod(NOW)).toEqual({ from: '2026-08-11', to: '2026-09-10' });
  });

  it('подставляется, когда в адресе периода нет', () => {
    const state = parse('q=интернет');

    expect(state.from).toBe('2026-08-11');
    expect(state.to).toBe('2026-09-10');
  });

  it('«за всё время» снимает период, а не растягивает его', () => {
    const state = parse('period=all');

    // Период длиной в век дал бы тот же результат и другой смысл: сервер
    // считает долю от периода, и «век» превратил бы её в ноль.
    expect(state).toMatchObject({ allTime: true, from: '', to: '' });
    expect(toApiQuery(state).from).toBeUndefined();
    expect(toApiQuery(state).to).toBeUndefined();
  });

  it('заданный период не перетирается умолчанием', () => {
    expect(parse('from=2026-01-01&to=2026-01-31')).toMatchObject({
      from: '2026-01-01',
      to: '2026-01-31',
    });
  });
});

describe('разбор адреса терпим к мусору', () => {
  it.each(['segment=marsian', 'segment=', 'segment=B2B'])(
    'неизвестный сегмент (%s) — это «любой», а не ошибка',
    (query) => {
      expect(parse(query).segment).toBe('');
    },
  );

  it('неизвестный продукт — «любой»', () => {
    expect(parse('product=спутник').product).toBe('');
  });

  it.each(['page=0', 'page=-3', 'page=абв', 'page='])('битая страница (%s) — первая', (query) => {
    expect(parse(query).page).toBe(1);
  });

  it('чужая ссылка с мусором открывает экран, а не сообщение об ошибке', () => {
    const state = parse('q=тариф&segment=xx&product=yy&page=zz&operator_id=не-uuid');

    expect(state.q).toBe('тариф');
    expect(state.page).toBe(1);
    // Идентификаторы не выдумываются: неизвестный оператор уедет на сервер и
    // получит там осмысленный отказ, а не будет молча стёрт.
    expect(state.operatorId).toBe('не-uuid');
  });
});

describe('сборка адреса', () => {
  it('пустые параметры не попадают в ссылку', () => {
    const query = toSearchParams(parse('q=  интернет  ')).toString();

    expect(query).toContain('q=');
    expect(query).not.toContain('operator_id');
    expect(query).not.toContain('page');
  });

  it('адрес и разбор — обратные друг другу', () => {
    const original = parse(
      'q=тариф&from=2026-01-01&to=2026-01-31&segment=b2b&product=wallet&page=3',
    );

    const restored = parseSearchState(toSearchParams(original), NOW);

    expect(restored).toEqual(original);
  });

  it('«за всё время» переживает круг через адрес', () => {
    const original = parse('period=all&q=тариф');

    expect(parseSearchState(toSearchParams(original), NOW)).toEqual(original);
  });
});

describe('параметры запроса', () => {
  it('границы суток считаются в зоне показа, а не в UTC', () => {
    // До 2026-09-17 границы уходили в UTC, и для московского
    // пользователя выбранные сутки превращались в «с 03:00 этого дня до
    // 02:59 следующего»: ночь следующего дня попадала в выдачу, а своя — нет.
    const query = toApiQuery(parse('from=2026-01-01&to=2026-01-31'), 'Europe/Moscow');

    expect(query.from).toBe('2025-12-31T21:00:00.000Z');
    // Верхняя граница — начало следующих суток: сервер сравнивает
    // полуинтервалом, и последняя секунда суток перестаёт теряться.
    expect(query.to).toBe('2026-01-31T21:00:00.000Z');
  });

  it('ночной звонок попадает в свои сутки, а не в чужие', () => {
    const query = toApiQuery(parse('from=2026-09-16&to=2026-09-16'), 'Europe/Moscow');
    const midnight = Date.parse('2026-09-16T00:30:00+03:00');

    expect(Date.parse(String(query.from))).toBeLessThanOrEqual(midnight);
    expect(Date.parse(String(query.to))).toBeGreaterThan(midnight);
    // А половина первого следующего дня — уже не наша.
    expect(Date.parse(String(query.to))).toBeLessThanOrEqual(
      Date.parse('2026-09-17T00:30:00+03:00'),
    );
  });

  it('переход на летнее время считается по зоне, а не зашитым сдвигом', () => {
    // В Берлине 30 марта 2026 года сутки начинаются при +01:00, а кончаются
    // при +02:00. Зашитый сдвиг ошибся бы здесь на час — молча.
    const query = toApiQuery(parse('from=2026-03-29&to=2026-03-29'), 'Europe/Berlin');

    expect(query.from).toBe('2026-03-28T23:00:00.000Z');
    expect(query.to).toBe('2026-03-29T22:00:00.000Z');
  });

  it('пустой запрос не отправляется как пустая строка', () => {
    expect(toApiQuery(parse('')).q).toBeUndefined();
  });
});

describe('фильтр по классификации (SP-310)', () => {
  it('узел переживает круг через адрес и уходит в запрос', () => {
    const state = parse('node_id=n4&q=тариф');

    expect(state.nodeId).toBe('n4');
    expect(parseSearchState(toSearchParams(state), NOW)).toEqual(state);
    expect(toApiQuery(state).node_id).toBe('n4');
  });

  it('прежний topic_id не сужает выдачу чужим идентификатором', () => {
    expect(parse('topic_id=old').nodeId).toBe('');
  });

  it('тема из «Основных тем» ставит фильтр и возвращает на первую страницу', () => {
    const next = toggleNode({ ...EMPTY_STATE, q: 'интернет', page: 3 }, 'n4');

    expect(next).toMatchObject({ q: 'интернет', nodeId: 'n4', page: 1 });
  });

  it('повторное нажатие снимает фильтр, другая тема — заменяет', () => {
    expect(toggleNode({ ...EMPTY_STATE, nodeId: 'n4' }, 'n4').nodeId).toBe('');
    expect(toggleNode({ ...EMPTY_STATE, nodeId: 'n2' }, 'n4').nodeId).toBe('n4');
  });
});

describe('вкладка источника (S-35)', () => {
  it('без source в адресе — NCC: старые ссылки открывают то же, что до Телфина', () => {
    expect(parse('q=тариф').source).toBe('ncc');
  });

  it.each(['source=all', 'source=', 'source=TELPHIN', 'source=смешать'])(
    'неизвестный источник (%s) — вкладка NCC, а не ошибка и не смесь',
    (query) => {
      expect(parse(query).source).toBe('ncc');
    },
  );

  it('Телфин переживает круг через адрес, NCC в адрес не пишется', () => {
    const telphin = parse('source=telphin&q=тариф&from=2026-01-01&to=2026-01-31');

    expect(telphin.source).toBe('telphin');
    expect(toSearchParams(telphin).get('source')).toBe('telphin');
    expect(parseSearchState(toSearchParams(telphin), NOW)).toEqual(telphin);
    expect(toSearchParams(parse('q=тариф')).has('source')).toBe(false);
  });

  it('источник уходит в каждый запрос, и умолчание тоже', () => {
    // Выдача, выгрузка (тот же toApiQuery) и KPI с «Основными темами».
    expect(toApiQuery(parse('')).source).toBe('ncc');
    expect(toApiQuery(parse('source=telphin')).source).toBe('telphin');
    expect(statsQuery(parse('source=telphin&period=all'))).toEqual({
      from: undefined,
      to: undefined,
      period: 'all',
      source: 'telphin',
    });
  });

  it('смена вкладки сбрасывает оператора, очередь и страницу, остальное держит', () => {
    const before = {
      ...EMPTY_STATE,
      q: 'тариф',
      from: '2026-01-01',
      to: '2026-01-31',
      operatorId: 'op-ncc',
      projectId: 'queue-ncc',
      nodeId: 'n4',
      segment: 'b2b' as const,
      product: 'broadband' as const,
      page: 3,
    };

    expect(switchSource(before, 'telphin')).toEqual({
      ...before,
      source: 'telphin',
      operatorId: '',
      projectId: '',
      page: 1,
    });
  });

  it('нажатие на открытую вкладку ничего не сбрасывает', () => {
    const state = { ...EMPTY_STATE, source: 'telphin' as const, operatorId: 'op', page: 2 };

    expect(switchSource(state, 'telphin')).toBe(state);
  });
});

describe('подпись режима (SRC-01)', () => {
  it.each([
    ['', 'browse'],
    ['   ', 'browse'],
    ['не работает интернет', 'any_order'],
    ['"не работает интернет"', 'phrase'],
    ['тариф "и точная фраза"', 'phrase'],
  ])('%s → %s', (query, expected) => {
    expect(queryMode(query)).toBe(expected);
  });

  it('у каждого режима есть подпись', () => {
    for (const mode of ['phrase', 'any_order', 'browse'] as const) {
      expect(MODE_LABEL[mode]).toBeTruthy();
    }
  });
});
