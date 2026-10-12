import { describe, expect, it } from 'vitest';
import type { DashboardResponse } from '../api/types';
import {
  axisTicks,
  bucketLabel,
  dashboardQuery,
  exportHref,
  inSlotOrder,
  isDialogsLink,
  OTHER_THEME,
  parseDashboardState,
  signedPercent,
  summaryText,
  themeSlots,
  toDashboardParams,
  topicHref,
} from './dashboard';

const NOW = new Date('2026-10-08T09:00:00Z');

/**
 * Разбирает строку запроса в состояние дашборда на условленный момент.
 *
 * @param query Строка запроса без вопросительного знака.
 * @returns Состояние дашборда.
 */
function parse(query: string) {
  return parseDashboardState(new URLSearchParams(query), NOW);
}

/**
 * Заменяет в тексте любые пробелы обычными.
 *
 * Разряды числа разделяет неразрывный пробел: в ожиданиях он обычный.
 *
 * @param text Текст с неразрывными пробелами.
 * @returns Тот же текст с обычными пробелами.
 */
function plain(text: string): string {
  return text.replace(/\s/g, ' ');
}

/**
 * Собирает ответ дашборда для теста.
 *
 * @param patch Поля, которые отличаются от умолчаний.
 * @returns Ответ с тремя темами и тысячей обращений.
 */
function board(patch: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    contract_version: '2.4',
    first_day: '2026-09-14',
    last_day: '2026-09-27',
    grain: 'week',
    calls: 1000,
    themes: [
      { key: 'не работает', label: 'Не работает', calls: 600, share: 0.6, negative_share: 0.3 },
      { key: 'тарифы', label: 'Тарифы', calls: 300, share: 0.3, negative_share: 0.1 },
      { key: OTHER_THEME, label: 'Прочее', calls: 100, share: 0.1, negative_share: 0.5 },
    ],
    buckets: [],
    selection: {
      theme: null,
      label: null,
      calls: 1000,
      negative_share: 0.26,
      change: 0.12,
      peak: { start: '2026-09-21', end: '2026-09-27', calls: 560 },
      subtopics: [],
    },
    ...patch,
  };
}

describe('состояние дашборда в адресе', () => {
  it('без параметров — период по умолчанию, корзину выбирает сервер, тема не выбрана', () => {
    const state = parse('');
    expect(state.grain).toBe('');
    expect(state.theme).toBe('');
    expect(state.to).toBe('2026-10-08');
    expect(state.from < state.to).toBe(true);
  });

  it('читает и пишет период, корзину и тему', () => {
    const state = parse('from=2026-09-01&to=2026-09-30&grain=day&theme=не+работает');
    expect(state).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      grain: 'day',
      theme: 'не работает',
    });
    expect(parse(toDashboardParams(state).toString())).toEqual(state);
  });

  it('чужое значение — не значение', () => {
    const state = parse('from=2026-13-45&grain=hour');
    expect(state.grain).toBe('');
    expect(state.from).not.toBe('2026-13-45');
    // Перевёрнутый период не доходит до сервера отказом.
    expect(parse('from=2026-09-30&to=2026-09-01').from).toBe('2026-09-01');
  });

  it('просит сутки в поясе колл-центра; пустые корзина и тема в запрос не идут', () => {
    const query = dashboardQuery(parse('from=2026-09-14&to=2026-09-20'), 'Europe/Moscow');
    expect(query).toEqual({
      from: '2026-09-13T21:00:00.000Z',
      to: '2026-09-20T21:00:00.000Z',
      grain: undefined,
      theme: undefined,
    });
  });

  it('старая ссылка на корень с параметрами поиска — это ссылка в «Диалоги»', () => {
    expect(isDialogsLink(new URLSearchParams('q=роуминг&from=2026-09-01'))).toBe(true);
    expect(isDialogsLink(new URLSearchParams('node_id=abc'))).toBe(true);
    // Период есть у обоих экранов: по нему одному ссылку не отличить.
    expect(isDialogsLink(new URLSearchParams('from=2026-09-01&to=2026-09-30'))).toBe(false);
    expect(isDialogsLink(new URLSearchParams('theme=тарифы&grain=week'))).toBe(false);
  });

  it('плитка темы ведёт в поиск по её ветке за тот же период', () => {
    const href = topicHref({ from: '2026-09-14', to: '2026-09-20' }, 'node-1');
    const url = new URL(href, 'http://speech');
    expect(url.pathname).toBe('/dialogs');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: '2026-09-14',
      to: '2026-09-20',
      node_id: 'node-1',
    });
  });

  it('в файл идут период и корзина экрана, тема — нет', () => {
    const state = parse('from=2026-09-14&to=2026-09-20&grain=day&theme=тарифы');
    const url = new URL(exportHref(state, 'Europe/Moscow'), 'http://speech');
    expect(url.pathname).toBe('/api/v1/dashboard.xlsx');
    expect([...url.searchParams.keys()].sort()).toEqual(['from', 'grain', 'to']);
  });
});

describe('показ', () => {
  it('подписи столбцов: день, начало недели, месяц', () => {
    const week = { from: '2026-09-14', to: '2026-09-20' };
    expect(bucketLabel(week, 'day')).toBe('14.09');
    expect(bucketLabel(week, 'week')).toBe('14.09');
    expect(bucketLabel(week, 'month')).toBe('сен');
    expect(bucketLabel(week, 'month', true)).toBe('сен 26');
  });

  it('шкала — круглые деления, верх не ниже наибольшего столбца', () => {
    expect(axisTicks(111)).toEqual([0, 50, 100, 150]);
    expect(axisTicks(8)).toEqual([0, 2, 4, 6, 8]);
    expect(axisTicks(2340)).toEqual([0, 1000, 2000, 3000]);
    expect(axisTicks(0)).toEqual([0, 1]);
    for (const max of [1, 3, 7, 19, 26, 380, 1999]) {
      expect(axisTicks(max).at(-1)).toBeGreaterThanOrEqual(max);
    }
  });

  it('изменение — со знаком, минус настоящий', () => {
    expect(signedPercent(0.123)).toBe('+12%');
    expect(signedPercent(-0.08)).toBe('−8%');
    expect(signedPercent(0.001)).toBe('0%');
  });

  it('цвет темы держится за тему, а не за место в рейтинге', () => {
    const now = [{ key: 'тарифы' }, { key: 'не работает' }, { key: OTHER_THEME }];
    const later = [{ key: 'не работает' }, { key: 'тарифы' }, { key: OTHER_THEME }];
    // Темы поменялись местами по числу звонков — цвета остались при них.
    expect(themeSlots(now)).toEqual(themeSlots(later));
    expect(themeSlots(now).get('не работает')).toBe(0);
    expect(themeSlots(now).get('тарифы')).toBe(1);
    // «Прочее» — последнее: и в столбце, и в легенде.
    expect(inSlotOrder(now).map((theme) => theme.key)).toEqual([
      'не работает',
      'тарифы',
      OTHER_THEME,
    ]);
  });
});

describe('итог за период', () => {
  it('по всем темам: сколько, что чаще, негатив, изменение', () => {
    expect(plain(summaryText(board()))).toBe(
      'За период 1 000 обращений с темой. Чаще всего — «Не работает» (60%), затем «Тарифы» (30%). ' +
        'Доля негатива — 26%, выше всего у темы «Не работает» — 30%. ' +
        'Во второй половине периода обращений на 12% больше, чем в первой.',
    );
  });

  it('по выбранной теме: её доля и главная подтема', () => {
    const text = summaryText(
      board({
        selection: {
          theme: 'не работает',
          label: 'Не работает',
          calls: 600,
          negative_share: 0.3,
          change: -0.25,
          peak: null,
          subtopics: [{ key: 'wi-fi', label: 'Wi-Fi', calls: 300, share: 0.5 }],
        },
      }),
    );
    expect(text).toBe(
      '«Не работает»: 600 обращений за период — 60% от всех. Чаще всего — «Wi-Fi» (50%). ' +
        'Доля негатива — 30%. Во второй половине периода обращений на 25% меньше, чем в первой.',
    );
  });

  it('пустой период и тема без обращений называются прямо', () => {
    expect(summaryText(board({ calls: 0 }))).toBe('За период нет разобранных обращений с темой.');
    const absent = board({
      selection: { theme: 'роуминг', label: 'Роуминг', calls: 0, subtopics: [] },
    });
    expect(summaryText(absent)).toBe('По теме «Роуминг» за период обращений нет.');
  });

  it('слово после числа стоит в нужной форме', () => {
    /**
     * Берёт первое предложение итога для заданного числа обращений.
     *
     * @param calls Число обращений за период.
     * @returns Первое предложение итога с обычными пробелами.
     */
    const start = (calls: number) => plain(summaryText(board({ calls }))).split('.')[0];
    expect(start(71)).toBe('За период 71 обращение с темой');
    expect(start(2)).toBe('За период 2 обращения с темой');
    expect(start(12)).toBe('За период 12 обращений с темой');
  });

  it('без тональности и без половин периода эти фразы пропускаются', () => {
    const text = summaryText(
      board({
        selection: { theme: null, label: null, calls: 1000, negative_share: null, change: null },
      }),
    );
    expect(plain(text)).toBe(
      'За период 1 000 обращений с темой. Чаще всего — «Не работает» (60%), затем «Тарифы» (30%).',
    );
  });
});
