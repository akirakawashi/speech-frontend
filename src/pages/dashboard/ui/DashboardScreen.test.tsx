import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StatsResponse } from '@/features/call-search';
import type { DashboardResponse } from '../api/types';
import type { DashboardState } from '../model/dashboard';
import { DashboardScreen } from './DashboardScreen';

const can = vi.hoisted(() => vi.fn<(permission: string) => boolean>());

vi.mock('@/entities/session', () => ({
  PERM_EXPORT: 'export',
  PERM_QUALITY: 'quality',
  useSession: () => ({ status: 'ready', can }),
}));

const STATS: StatsResponse = {
  contract_version: '2.4',
  processed: 1200,
  transcribed: 1140,
  queued: 60,
  topics: [
    {
      node_id: 'aaaaaaaa-0000-4000-8000-000000000001',
      path: ['Физ.лицо', 'ШПД', 'Консультация', 'Не работает'],
      calls: 410,
    },
  ],
};

const BOARD: DashboardResponse = {
  contract_version: '2.4',
  first_day: '2026-09-14',
  last_day: '2026-09-27',
  grain: 'week',
  calls: 1000,
  themes: [
    { key: 'тарифы', label: 'Тарифы', calls: 600, share: 0.6, negative_share: 0.1 },
    { key: 'не работает', label: 'Не работает', calls: 400, share: 0.4, negative_share: 0.5 },
  ],
  buckets: [
    {
      start: '2026-09-14',
      end: '2026-09-20',
      calls: 440,
      by_theme: [240, 200],
      negative_share: 0.2,
    },
    {
      start: '2026-09-21',
      end: '2026-09-27',
      calls: 560,
      by_theme: [360, 200],
      negative_share: 0.3,
    },
  ],
  selection: {
    theme: null,
    label: null,
    calls: 1000,
    negative_share: 0.26,
    change: 0.2727,
    peak: { start: '2026-09-21', end: '2026-09-27', calls: 560 },
    subtopics: [],
  },
};

const CHOSEN: DashboardResponse = {
  ...BOARD,
  selection: {
    theme: 'не работает',
    label: 'Не работает',
    calls: 400,
    negative_share: 0.5,
    change: 0,
    peak: { start: '2026-09-14', end: '2026-09-20', calls: 200 },
    subtopics: [
      { key: 'wi-fi', label: 'Wi-Fi', calls: 300, share: 0.75 },
      { key: '', label: 'Без уточнения', calls: 100, share: 0.25 },
    ],
  },
};

/**
 * Собирает успешный ответ сервера с телом JSON.
 *
 * @param body Тело ответа.
 * @returns Ответ с кодом `200`.
 */
function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Подменяет сеть ответами дашборда и счётов периода.
 *
 * @param dashboard Строит ответ дашборда по адресу запроса.
 * @returns Подмена `fetch`, которая запоминает свои вызовы.
 */
function respond(dashboard: (url: URL) => DashboardResponse = () => BOARD) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/v1/stats') return json(STATS);
    if (url.pathname === '/api/v1/dashboard') return json(dashboard(url));
    return new Response('{}', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * Достаёт параметры последнего запроса дашборда.
 *
 * @param fetchMock Подмена `fetch`.
 * @returns Параметры строки запроса.
 * @throws {Error} Запроса дашборда не было.
 */
function asked(fetchMock: ReturnType<typeof respond>): URLSearchParams {
  const last = fetchMock.mock.calls
    .map(([input]) => new URL(String(input)))
    .filter((url) => url.pathname === '/api/v1/dashboard')
    .at(-1);
  if (!last) throw new Error('no dashboard request');
  return last.searchParams;
}

/**
 * Собирает состояние дашборда для теста.
 *
 * @param patch Поля, которые отличаются от умолчаний.
 * @returns Состояние с двухнедельным периодом, без корзины и темы.
 */
function state(patch: Partial<DashboardState> = {}): DashboardState {
  return { from: '2026-09-14', to: '2026-09-27', grain: '', theme: '', ...patch };
}

/**
 * Отрисовывает разметку внутри своего кэша запросов.
 *
 * @param node Разметка под тестом.
 * @returns Результат отрисовки Testing Library.
 */
function withQueries(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

/**
 * Экран с настоящим состоянием: клик меняет то, что уходит в следующий запрос.
 *
 * @param props Свойства компонента.
 * @param props.initial Состояние, с которого экран открыт.
 * @returns Экран дашборда.
 */
function Harness({ initial }: { initial: DashboardState }) {
  const [current, setCurrent] = useState(initial);
  return <DashboardScreen state={current} onChange={setCurrent} />;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('дашборд', () => {
  it('показывает обработку, плитки, столбцы тем и итог словами', async () => {
    can.mockReturnValue(false);
    const fetchMock = respond();
    withQueries(<Harness initial={state()} />);

    const chart = await screen.findByRole('region', { name: 'Обращения по темам' });
    expect(screen.getByRole('heading', { level: 1, name: 'Дашборд' })).toBeInTheDocument();

    // Период уходит сутками колл-центра; корзину и тему никто не выбирал.
    const query = asked(fetchMock);
    expect(query.get('from')).toBe('2026-09-13T21:00:00.000Z');
    expect(query.get('to')).toBe('2026-09-27T21:00:00.000Z');
    expect(query.has('grain')).toBe(false);
    expect(query.has('theme')).toBe(false);

    const processed = screen.getByRole('region', { name: 'Обработано звонков' });
    expect(processed).toHaveTextContent('1 200');
    expect(processed).toHaveTextContent('95% готово');

    // Плитка темы — ссылка в «Диалоги» по ветке за тот же период.
    const tile = within(screen.getByRole('region', { name: 'Основные темы за период' })).getByRole(
      'link',
    );
    expect(tile).toHaveTextContent('410');
    expect(tile).toHaveAttribute(
      'href',
      '/dialogs?from=2026-09-14&to=2026-09-27&node_id=aaaaaaaa-0000-4000-8000-000000000001',
    );

    // Столбец на корзину; легенда — в порядке мест палитры, а не по числу звонков.
    const columns = within(chart).getByRole('figure');
    expect(within(columns).getAllByRole('button')).toHaveLength(2);
    expect(within(columns).getByRole('button', { name: '14.09–20.09: 440' })).toBeInTheDocument();
    const legend = within(chart).getAllByRole('listitem').slice(0, 2);
    expect(legend.map((item) => item.textContent)).toEqual(['Не работает 40%', 'Тарифы 60%']);

    // Корзину назначил сервер — она и нажата.
    const grain = screen.getByRole('group', { name: 'Корзина графика' });
    expect(within(grain).getByRole('button', { name: 'Недели' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    expect(screen.getByRole('region', { name: 'Итог за период' })).toHaveTextContent(
      'Чаще всего — «Тарифы» (60%), затем «Не работает» (40%).',
    );
    expect(screen.getByRole('region', { name: 'Доля негатива' })).toHaveTextContent('26%');
    const detail = screen.getByRole('region', { name: 'Детализация' });
    expect(detail).toHaveTextContent('+27%');
    expect(detail).toHaveTextContent('21.09–27.09');
    // Без права на выгрузку кнопки файла нет.
    expect(screen.queryByRole('button', { name: 'Экспорт в Excel' })).not.toBeInTheDocument();
  });

  it('выбор темы пересчитывает итог и подтемы, столбцы остаются', async () => {
    can.mockReturnValue(false);
    const fetchMock = respond((url) => (url.searchParams.get('theme') ? CHOSEN : BOARD));
    withQueries(<Harness initial={state()} />);
    await screen.findByRole('region', { name: 'Обращения по темам' });
    expect(screen.queryByRole('region', { name: 'Внутренние темы' })).not.toBeInTheDocument();

    const themes = screen.getByRole('group', { name: 'Тема' });
    await userEvent.click(within(themes).getByRole('button', { name: 'Не работает' }));

    await waitFor(() => expect(asked(fetchMock).get('theme')).toBe('не работает'));
    const inner = await screen.findByRole('region', { name: 'Внутренние темы' });
    expect(inner).toHaveTextContent('Wi-Fi');
    expect(inner).toHaveTextContent('75%');
    expect(screen.getByRole('region', { name: 'Детализация' })).toHaveTextContent(
      'Детализация — Не работает',
    );
    expect(screen.getByRole('region', { name: 'Доля негатива' })).toHaveTextContent(
      'по теме «Не работает»',
    );
    expect(within(themes).getByRole('button', { name: 'Не работает' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      within(screen.getByRole('region', { name: 'Обращения по темам' })).getByRole('figure'),
    ).toBeInTheDocument();

    // Повторный клик снимает выбор.
    await userEvent.click(within(themes).getByRole('button', { name: 'Не работает' }));
    await waitFor(() => expect(asked(fetchMock).has('theme')).toBe(false));
  });

  it('корзина выбирается руками и сбрасывается сменой периода', async () => {
    can.mockReturnValue(false);
    const fetchMock = respond((url) => ({
      ...BOARD,
      grain: (url.searchParams.get('grain') as DashboardResponse['grain'] | null) ?? 'week',
    }));
    withQueries(<Harness initial={state()} />);
    await screen.findByRole('region', { name: 'Обращения по темам' });

    const grain = screen.getByRole('group', { name: 'Корзина графика' });
    await userEvent.click(within(grain).getByRole('button', { name: 'Дни' }));
    await waitFor(() => expect(asked(fetchMock).get('grain')).toBe('day'));
    await waitFor(() =>
      expect(within(grain).getByRole('button', { name: 'Дни' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );

    // Новая дата: «дни» для недели и для года — разные решения.
    await userEvent.click(screen.getByRole('button', { name: 'Период по 27.09.2026' }));
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Конец периода' })).getByRole('button', {
        name: '30.09.2026',
      }),
    );
    await waitFor(() => expect(asked(fetchMock).has('grain')).toBe(false));
    expect(asked(fetchMock).get('to')).toBe('2026-09-30T21:00:00.000Z');
  });

  it('тот же график отдаётся таблицей', async () => {
    can.mockReturnValue(false);
    respond();
    withQueries(<Harness initial={state()} />);
    const chart = await screen.findByRole('region', { name: 'Обращения по темам' });

    await userEvent.click(within(chart).getByRole('button', { name: 'Таблица' }));

    const rows = within(chart).getAllByRole('row');
    expect(rows.map((row) => row.textContent)).toEqual([
      'НеделиНе работаетТарифыВсегоНегатив',
      '14.09–20.09200240440' + '20%',
      '21.09–27.09200360560' + '30%',
    ]);
    expect(within(chart).queryByRole('figure')).not.toBeInTheDocument();
  });

  it('с правом на выгрузку есть кнопка файла; с правом на оценку — третья вкладка', async () => {
    can.mockReturnValue(true);
    respond();
    withQueries(<Harness initial={state()} />);
    await screen.findByRole('region', { name: 'Обращения по темам' });

    expect(screen.getByRole('button', { name: 'Экспорт в Excel' })).toBeEnabled();
    const tabs = within(screen.getByRole('navigation', { name: 'Разделы' })).getAllByRole('link');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Дашборд', 'Диалоги', 'Оценка качества']);
  });
});
