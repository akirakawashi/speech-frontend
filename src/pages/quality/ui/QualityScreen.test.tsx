import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CallResponse, SegmentModel } from '@/entities/call';
import type { CallQualityResponse } from '@/entities/evaluation';
import type { SearchResponse } from '@/features/call-search';
import type { QualityCallItem, QualityCallsResponse, QualitySummaryResponse } from '../api/types';
import { type QualityState, UNASSIGNED } from '../model/state';
import { QualityScreen } from './QualityScreen';

const POOR_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const GOOD_ID = 'aaaaaaaa-0000-4000-8000-000000000002';

const SUMMARY: QualitySummaryResponse = {
  contract_version: '2.1',
  script_version: 'volna-outbound-2026-04-01',
  total: 21,
  failed: 8,
  pending: 1,
  unavailable: 0,
  evaluated: 12,
  calls: 4,
  fully_correct: 2,
  fully_correct_share: 0.5,
  average_score: 70,
  buckets: { good: 2, fair: 1, poor: 1 },
  violations: 0,
  stages: [
    {
      key: 'greeting',
      label: 'Приветствие, установление контакта',
      mandatory: false,
      calls: 4,
      applicable: 4,
      passed: 3,
      failed: 1,
      share: 0.75,
    },
    {
      key: 'objections',
      label: 'Отработка возражений',
      mandatory: false,
      calls: 4,
      applicable: 2,
      passed: 3,
      failed: 1,
      share: 0.75,
    },
    {
      key: 'passport',
      label: 'Обязательные условия — паспорт держателя, 18+',
      mandatory: true,
      calls: 4,
      applicable: 0,
      passed: 4,
      failed: 0,
      share: 1,
    },
  ],
  objections: [
    { type: 'cheaper', label: 'Мой тариф/провайдер выгоднее', raised: 2, handled: 1, share: 0.5 },
    { type: 'company', label: 'Что это за компания?', raised: 0, handled: 0, share: 0 },
  ],
  outcomes: [
    { key: 'request', label: 'Заявка оформлена', calls: 1, share: 0.25 },
    { key: 'callback', label: 'Перезвонить позже', calls: 3, share: 0.75 },
  ],
  operators: [
    {
      operator_id: 'op-2',
      login: 'petrov',
      full_name: 'Петров С.',
      calls: 1,
      average_score: 100,
      fully_correct: 1,
      fully_correct_share: 1,
      buckets: { good: 1, fair: 0, poor: 0 },
      violations: 0,
      stages: [
        { key: 'greeting', applicable: 1, failed: 0 },
        { key: 'objections', applicable: 0, failed: 0 },
        { key: 'passport', applicable: 0, failed: 0 },
      ],
    },
    {
      operator_id: 'op-1',
      login: 'ivanova',
      full_name: 'Иванова А.',
      calls: 3,
      average_score: 60,
      fully_correct: 1,
      fully_correct_share: 0.3333,
      buckets: { good: 1, fair: 1, poor: 1 },
      violations: 0,
      stages: [
        { key: 'greeting', applicable: 3, failed: 1 },
        { key: 'objections', applicable: 2, failed: 1 },
        { key: 'passport', applicable: 0, failed: 0 },
      ],
    },
  ],
  weeks: [
    {
      week_start: '2026-09-14',
      calls: 4,
      fully_correct: 2,
      fully_correct_share: 0.5,
      average_score: 70,
      buckets: { good: 2, fair: 1, poor: 1 },
    },
  ],
};

const POOR_CALL: QualityCallItem = {
  call_id: POOR_ID,
  session_id: 'node_1_domain_1_nauss_1_1_1',
  started_at: '2026-09-14T10:00:00Z',
  duration_s: 259,
  operator_id: 'op-1',
  operator_login: 'ivanova',
  operator_name: 'Иванова А.',
  evaluation_status: 'evaluated',
  script_applies: true,
  score: 60,
  bucket: 'poor',
  passed_count: 2,
  stage_count: 3,
  all_passed: false,
  violation: false,
  outcome: 'callback',
  outcome_label: 'Перезвонить позже',
  summary: 'Не ответила на возражение о цене.',
  failed_stages: ['Отработка возражений'],
  stages: [
    { key: 'greeting', applicable: true, passed: true },
    { key: 'objections', applicable: true, passed: false },
    { key: 'passport', applicable: false, passed: true },
  ],
};

const GOOD_CALL: QualityCallItem = {
  ...POOR_CALL,
  call_id: GOOD_ID,
  score: 100,
  bucket: 'good',
  passed_count: 3,
  all_passed: true,
  summary: 'Разговор по скрипту.',
  failed_stages: [],
  stages: [
    { key: 'greeting', applicable: true, passed: true },
    { key: 'objections', applicable: true, passed: true },
    { key: 'passport', applicable: false, passed: true },
  ],
};

const SKIPPED_CALL: QualityCallItem = {
  ...POOR_CALL,
  call_id: 'aaaaaaaa-0000-4000-8000-000000000003',
  script_applies: false,
  score: null,
  bucket: null,
  passed_count: null,
  stage_count: null,
  outcome: null,
  outcome_label: null,
  summary: 'Обращение в поддержку по оплате, а не продажа.',
  failed_stages: [],
  stages: [],
};

const SEGMENTS: SegmentModel[] = [
  { seq: 0, speaker: 'operator', start_ms: 3_000, end_ms: 5_000, text: 'Добрый день' },
  { seq: 1, speaker: 'client', start_ms: 65_000, end_ms: 70_000, text: 'У меня дешевле' },
  { seq: 2, speaker: 'operator', start_ms: 71_000, end_ms: 74_000, text: 'Понятно, до свидания' },
];

const CALL: CallResponse = {
  contract_version: '2.1',
  call_id: POOR_ID,
  session_id: 'node_1_domain_1_nauss_1_1_1',
  source: 'ncc',
  direction: 'outbound',
  started_at: '2026-09-14T10:00:00Z',
  ended_at: '2026-09-14T10:04:19Z',
  duration_s: 259,
  operator_login: 'ivanova',
  audio_status: 'stored',
  processing_status: 'done',
  analysis_status: 'done',
  segment_source: 'unknown',
  product_source: 'unknown',
  ai_suggestion_is_new: false,
  segments: SEGMENTS,
};

const EVALUATION: CallQualityResponse = {
  contract_version: '2.1',
  call_id: POOR_ID,
  script_version: 'volna-outbound-2026-04-01',
  model_name: 'local',
  evaluated_at: '2026-10-02T10:00:00Z',
  script_applies: true,
  score: 90,
  passed_count: 9,
  stage_count: 10,
  all_passed: false,
  outcome: 'refusal',
  outcome_label: 'Отказ',
  summary: 'Почти по скрипту.',
  stages: [
    {
      key: 'greeting',
      label: 'Приветствие, установление контакта',
      mandatory: false,
      applicable: true,
      passed: true,
      evidence: [0],
      comment: 'Представился.',
    },
    {
      key: 'passport',
      label: 'Обязательные условия — паспорт держателя, 18+',
      mandatory: true,
      applicable: true,
      passed: false,
      evidence: [],
      comment: 'Не сказал про паспорт.',
    },
    {
      key: 'busy',
      label: 'Отработка «неудобно говорить» (техника 2 минут)',
      mandatory: false,
      applicable: false,
      passed: true,
      evidence: [],
      comment: '',
    },
  ],
  objections: [
    {
      type: 'cheaper',
      label: 'Мой тариф/провайдер выгоднее',
      seq: 1,
      handled: false,
      evidence: [2],
      comment: 'Не ответил.',
    },
  ],
};

/**
 * Собирает состояние экрана оценки для теста.
 *
 * @param patch Поля, которые отличаются от умолчаний.
 * @returns Состояние с недельным периодом и без отбора.
 */
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

/**
 * Собирает ответ сервера с телом JSON.
 *
 * @param body Тело ответа.
 * @param status Код ответа HTTP.
 * @returns Ответ с заголовком `Content-Type: application/json`.
 */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Собирает страницу списка звонков для теста.
 *
 * @param items Звонки страницы.
 * @returns Ответ списка, где всего столько же звонков, сколько на странице.
 */
function calls(...items: QualityCallItem[]): QualityCallsResponse {
  return { contract_version: '2.1', total: items.length, items };
}

/**
 * Подменяет сеть ответами по путям.
 *
 * @param routes Ответы по путям запроса; путь без ответа получает `404`.
 * @returns Подмена `fetch`, которая запоминает свои вызовы.
 */
function respond(routes: Record<string, (url: URL) => Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const route = routes[url.pathname];
    return route ? route(url) : new Response('{}', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * Достаёт последний запрос по пути — то, что экран спросил после действия человека.
 *
 * @param fetchMock Подмена `fetch`.
 * @param pathname Путь ручки.
 * @returns Параметры строки запроса.
 * @throws {Error} Запроса по этому пути не было.
 */
function lastRequest(fetchMock: ReturnType<typeof respond>, pathname: string): URLSearchParams {
  const urls = fetchMock.mock.calls
    .map(([input]) => new URL(String(input)))
    .filter((url) => url.pathname === pathname);
  const last = urls.at(-1);
  if (!last) throw new Error(`no request to ${pathname}`);
  return last.searchParams;
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
 * @param props.seen Получает каждое новое состояние экрана — чтобы тест видел, что ушло в адрес.
 * @returns Экран оценки качества.
 */
function Harness({
  initial,
  seen,
}: {
  initial: QualityState;
  seen?: (next: QualityState) => void;
}) {
  const [current, setCurrent] = useState(initial);
  return (
    <QualityScreen
      state={current}
      onChange={(next) => {
        seen?.(next);
        setCurrent(next);
      }}
    />
  );
}

const SCREEN_ROUTES = {
  '/api/v1/quality/summary': () => json(SUMMARY),
  '/api/v1/quality/calls': (url: URL) =>
    json(
      url.searchParams.get('applies') === 'false'
        ? calls(SKIPPED_CALL)
        : calls(POOR_CALL, GOOD_CALL),
    ),
};

describe('экран оценки качества', () => {
  it('сохраняет все 12 записей на экране, показывает ошибки и открывает их разговор', async () => {
    const failures: QualityCallItem[] = Array.from({ length: 8 }, (_, index) => ({
      ...POOR_CALL,
      call_id: `aaaaaaaa-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
      evaluation_status: 'failed',
      failure_reason: index < 6 ? 'roles_undetermined' : 'invalid_evaluation',
      script_applies: null,
      score: null,
      bucket: null,
      all_passed: null,
      passed_count: null,
      stage_count: null,
      outcome: null,
      outcome_label: null,
      summary: null,
      violation: false,
      failed_stages: [],
      stages: [],
    }));
    const all = [
      POOR_CALL,
      GOOD_CALL,
      SKIPPED_CALL,
      { ...SKIPPED_CALL, call_id: 'aaaaaaaa-0000-4000-8000-000000000004' },
      ...failures,
    ];
    const fetchMock = respond({
      '/api/v1/quality/summary': () =>
        json({
          ...SUMMARY,
          total: 12,
          evaluated: 4,
          calls: 2,
          failed: 8,
          pending: 0,
          buckets: { poor: 1, fair: 0, good: 1 },
        }),
      '/api/v1/quality/calls': (url) =>
        json(calls(...(url.searchParams.get('evaluation_status') === 'failed' ? failures : all))),
      [`/api/v1/calls/${failures[0]?.call_id}`]: () =>
        json({ ...CALL, call_id: failures[0]?.call_id }),
      [`/api/v1/calls/${failures[0]?.call_id}/quality`]: () =>
        json({ detail: 'quality_roles_undetermined' }, 404),
    });
    withQueries(<Harness initial={state()} />);
    const overview = within(await screen.findByRole('region', { name: 'Картина периода' }));
    expect(overview.getByRole('button', { name: 'Все записи: 12' })).toBeInTheDocument();
    expect(overview.getByRole('button', { name: /Не удалось оценить/ })).toHaveTextContent('8');
    const list = within(screen.getByRole('region', { name: 'Звонки' }));
    await waitFor(() => expect(list.getByText('· 12 звонков')).toBeInTheDocument());
    expect(list.getAllByText('Не удалось оценить')).toHaveLength(8);
    expect(
      list.getAllByText('Не удалось оценить звонок: роли оператора и клиента не определены.'),
    ).toHaveLength(6);
    expect(list.queryByText('0%')).not.toBeInTheDocument();

    await userEvent.click(overview.getByRole('button', { name: /Не удалось оценить/ }));
    expect(lastRequest(fetchMock, '/api/v1/quality/calls').get('evaluation_status')).toBe('failed');
    expect(lastRequest(fetchMock, '/api/v1/quality/calls').has('applies')).toBe(false);
    await waitFor(() => expect(list.getByText('· 8 звонков')).toBeInTheDocument());
    const row = list.getAllByRole('button', { name: /роли оператора и клиента не определены/ })[0];
    if (!row) throw new Error('No failed call in the list');
    await userEvent.click(row);
    const review = within(await screen.findByRole('complementary', { name: 'Разбор звонка' }));
    expect(await review.findByRole('alert')).toHaveTextContent(
      'роли оператора и клиента не определены',
    );
    expect(await review.findByText('Добрый день')).toBeInTheDocument();
    expect(review.queryByText('0%')).not.toBeInTheDocument();
  });

  it('ожидающий оценки звонок виден с правильной подписью', async () => {
    respond({
      ...SCREEN_ROUTES,
      '/api/v1/quality/calls': () =>
        json(
          calls({
            ...SKIPPED_CALL,
            evaluation_status: 'pending',
            script_applies: null,
            all_passed: null,
            summary: null,
          }),
        ),
    });
    withQueries(<Harness initial={state({ evaluationStatus: 'pending' })} />);
    const list = within(await screen.findByRole('region', { name: 'Звонки' }));
    expect(await list.findByText('Ожидает оценки')).toBeInTheDocument();
    expect(list.queryByText('вне скрипта — не оценивался')).not.toBeInTheDocument();
  });

  it('звонок без расшифровки не числится ожидающим оценки', async () => {
    respond({
      '/api/v1/quality/summary': () => json({ ...SUMMARY, unavailable: 3 }),
      '/api/v1/quality/calls': () =>
        json(
          calls({
            ...SKIPPED_CALL,
            evaluation_status: 'unavailable',
            script_applies: null,
            all_passed: null,
            summary: null,
          }),
        ),
    });
    withQueries(<Harness initial={state()} />);

    const overview = within(await screen.findByRole('region', { name: 'Картина периода' }));
    expect(overview.getByText(/Без расшифровки/)).toHaveTextContent('Без расшифровки: 3');
    const list = within(screen.getByRole('region', { name: 'Звонки' }));
    expect(await list.findByText('Нет расшифровки — оценить нельзя')).toBeInTheDocument();
    expect(list.queryByText('Ожидает оценки')).not.toBeInTheDocument();
  });

  it('показывает картину, этапы, сотрудников и звонки — худшие первыми', async () => {
    const fetchMock = respond(SCREEN_ROUTES);
    withQueries(<Harness initial={state()} />);

    expect(
      await screen.findByText(/Из 4 звонков по скрипту плохих — 1, хороших — 2/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Плохие/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /Не по скрипту/ })).toHaveTextContent('8');

    // Процент этапа — как в макете: доля звонков, где этап засчитан. Этап,
    // который не понадобился, по правилу заказчика засчитывается: три из четырёх.
    const stages = within(screen.getByRole('region', { name: 'Корректность этапов' }));
    const objections = stages.getByRole('button', { name: /Отработка возражений/ });
    expect(objections).toHaveTextContent('75%');
    // Три числа раздельно — в подсказке строки.
    expect(objections).toHaveAttribute(
      'title',
      expect.stringContaining('Выполнен 1, не выполнен 1, не понадобился 2'),
    );
    const passport = stages.getByRole('button', { name: /паспорт/ });
    expect(passport).toHaveTextContent('100%');
    expect(passport).toHaveTextContent('чек-лист');
    expect(stages.getByText(/Текущий период/)).toHaveTextContent('14.09.2026 – 20.09.2026');

    // Сотрудники — от лучшего балла, как в макете, как бы их ни отдал сервер.
    const employees = within(
      screen.getByRole('region', { name: 'Оценки сотрудников' }),
    ).getAllByRole('button');
    expect(employees[0]).toHaveTextContent('Петров С.');
    expect(employees[0]).toHaveTextContent('100%');
    expect(employees[1]).toHaveTextContent('Иванова А.');
    expect(employees[1]).toHaveTextContent('3 звонка');

    // Недели — доля полностью корректных звонков, а не средний балл.
    const weeks = within(
      screen.getByRole('region', { name: 'Полностью корректные звонки по неделям' }),
    );
    expect(
      weeks.getByRole('button', { name: 'Неделя 14.09–20.09: полностью корректных 2 из 4, 50%' }),
    ).toHaveAttribute('aria-pressed', 'true');

    // Итог звонка — диаграмма: в центре доля заявок от звонков по скрипту.
    const outcome = within(screen.getByRole('region', { name: 'Итог звонка' }));
    expect(outcome.getByText('заявка').previousSibling).toHaveTextContent('25%');
    expect(outcome.getByRole('button', { name: /Перезвонить позже/ })).toHaveTextContent('75%');

    const list = within(screen.getByRole('region', { name: 'Звонки' }));
    expect(await list.findByText('60%')).toBeInTheDocument();
    expect(list.getByText('не выполнено: 1')).toBeInTheDocument();
    expect(list.getByText('все этапы выполнены')).toBeInTheDocument();
    expect(lastRequest(fetchMock, '/api/v1/quality/calls').get('sort')).toBe('worst');

    // Возражения — шестью карточками макета: отработано одно из двух.
    const objectionCards = within(
      screen.getByRole('region', { name: 'Отработка возражений по типам' }),
    );
    expect(objectionCards.getAllByRole('listitem')).toHaveLength(6);
    const cheaper = objectionCards.getByText('Мой тариф/провайдер выгоднее').closest('li');
    expect(cheaper).toHaveTextContent('50%');
    expect(cheaper).toHaveAttribute('title', 'Отработано 1 из 2');
    // Карточка возражения, которое не звучало, остаётся на месте с прочерком.
    expect(objectionCards.getByText('Не интересно').closest('li')).toHaveTextContent('не звучало');
    // Возражение вне шести карточек называется под сеткой — и только если звучало.
    expect(screen.queryByText(/Что это за компания/)).not.toBeInTheDocument();
  });

  it('разряд сужает список звонков, а сводка остаётся прежней', async () => {
    const fetchMock = respond(SCREEN_ROUTES);
    withQueries(<Harness initial={state()} />);

    await userEvent.click(await screen.findByRole('button', { name: /Плохие/ }));

    expect(lastRequest(fetchMock, '/api/v1/quality/calls').get('bucket')).toBe('poor');
    expect(lastRequest(fetchMock, '/api/v1/quality/summary').has('bucket')).toBe(false);
    // Плитка и метка отбора над списком называются одинаково — различаются блоком.
    const overview = within(screen.getByRole('region', { name: 'Картина периода' }));
    expect(overview.getByRole('button', { name: /Плохие/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Отбор виден над списком и снимается там же.
    const list = within(screen.getByRole('region', { name: 'Звонки' }));
    await userEvent.click(list.getByRole('button', { name: /Плохие/ }));
    expect(lastRequest(fetchMock, '/api/v1/quality/calls').has('bucket')).toBe(false);
  });

  it('этап открывается с обеих сторон: где не выполнен и где выполнен', async () => {
    const fetchMock = respond(SCREEN_ROUTES);
    withQueries(<Harness initial={state()} />);

    const stages = within(await screen.findByRole('region', { name: 'Корректность этапов' }));
    await userEvent.click(stages.getByRole('button', { name: /Отработка возражений/ }));

    // Сначала — ошибки: за ними обычно и приходят.
    const failed = lastRequest(fetchMock, '/api/v1/quality/calls');
    expect([failed.get('stage'), failed.get('stage_state')]).toEqual(['objections', 'failed']);

    // Переключатель над списком — те же звонки этапа, но выполненные образцово.
    const list = within(screen.getByRole('region', { name: 'Звонки' }));
    expect(list.getByRole('button', { name: 'не выполнен · 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(list.getByRole('button', { name: 'выполнен · 1' }));
    expect(lastRequest(fetchMock, '/api/v1/quality/calls').get('stage_state')).toBe('done');
    expect(list.getByRole('button', { name: 'не понадобился · 2' })).toBeInTheDocument();

    await userEvent.click(list.getByRole('button', { name: 'Убрать отбор по этапу' }));
    expect(lastRequest(fetchMock, '/api/v1/quality/calls').has('stage')).toBe(false);
  });

  it('строка сотрудника сужает экран до него и открывает его карточку', async () => {
    const fetchMock = respond(SCREEN_ROUTES);
    withQueries(<Harness initial={state()} />);

    const row = { name: /Иванова А\./ };
    /**
     * Находит блок «Оценки сотрудников» на экране.
     *
     * @returns Запросы Testing Library внутри блока.
     */
    const employees = () => within(screen.getByRole('region', { name: 'Оценки сотрудников' }));
    await screen.findByRole('region', { name: 'Оценки сотрудников' });
    await userEvent.click(employees().getByRole('button', row));

    // Сотрудник — охват: по нему пересчитываются и сводка, и список звонков.
    expect(lastRequest(fetchMock, '/api/v1/quality/calls').get('operator_id')).toBe('op-1');
    expect(lastRequest(fetchMock, '/api/v1/quality/summary').get('operator_id')).toBe('op-1');
    expect(screen.getByLabelText('Сотрудники')).toHaveValue('op-1');

    const card = within(await screen.findByRole('region', { name: 'Статистика — Иванова А.' }));
    expect(card.getByText('Общий балл').nextSibling).toHaveTextContent('60%');
    expect(card.getByText('Звонков оценено').nextSibling).toHaveTextContent('3');
    // Прошлый период отдал тот же балл: динамика — «стабильно», в подсказке —
    // с чем сравнили.
    await waitFor(() =>
      expect(card.getByText('Динамика').nextSibling).toHaveTextContent('→ стабильно'),
    );
    expect(card.getByText('Динамика').nextSibling).toHaveAttribute(
      'title',
      'Было 60% за 07.09–13.09',
    );
    // Слабый этап — с наименьшим выполнением там, где он был нужен: 1 из 2.
    expect(card.getByText('Слабый этап').nextSibling).toHaveTextContent('Отработка возражений 50%');
    // Блок этапов говорит, чьи это числа, а список сотрудников остаётся целым.
    expect(
      screen.getByRole('heading', { name: 'Корректность этапов — Иванова А.' }),
    ).toBeInTheDocument();
    expect(employees().getByRole('button', { name: /Петров С\./ })).toBeInTheDocument();

    // В карточке — его разговоры, и разговор открывается в разборе.
    expect(await card.findByText('Разговоры за выбранный период — 2 всего')).toBeInTheDocument();
    const opens = card.getAllByRole('button', { name: 'Открыть звонок →' });
    expect(opens).toHaveLength(2);
    await userEvent.click(opens[0] as HTMLElement);
    expect(await screen.findByRole('complementary', { name: 'Разбор звонка' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть разбор' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('complementary', { name: 'Разбор звонка' }),
      ).not.toBeInTheDocument(),
    );

    // Повторный клик возвращает всех сотрудников.
    await userEvent.click(employees().getByRole('button', row));
    await waitFor(() =>
      expect(lastRequest(fetchMock, '/api/v1/quality/calls').has('operator_id')).toBe(false),
    );
    expect(screen.queryByRole('region', { name: /Статистика/ })).not.toBeInTheDocument();
  });

  it('динамика — к прошлому периоду той же длины; без звонков в нём подписи нет', async () => {
    /**
     * Выбраны 14–20 сентября, прошлый период — 7–13 сентября.
     *
     * @param url Адрес запроса сводки.
     * @returns `true`, если период запроса начинается раньше выбранного.
     */
    const earlier = (url: URL) => (url.searchParams.get('from') ?? '') < '2026-09-10';
    const fetchMock = respond({
      ...SCREEN_ROUTES,
      '/api/v1/quality/summary': (url: URL) =>
        json(
          earlier(url)
            ? {
                ...SUMMARY,
                // Иванова выросла с 50 до 60; у Петрова в прошлом периоде звонков не было.
                operators: (SUMMARY.operators ?? [])
                  .filter((operator) => operator.login === 'ivanova')
                  .map((operator) => ({ ...operator, average_score: 50 })),
              }
            : SUMMARY,
        ),
    });
    withQueries(<Harness initial={state()} />);

    const employees = within(await screen.findByRole('region', { name: 'Оценки сотрудников' }));
    const ivanova = await employees.findByRole('button', { name: /Иванова А\..*↑ растёт/ });
    expect(within(ivanova).getByText('↑ растёт')).toHaveAttribute(
      'title',
      'Было 50% за 07.09–13.09',
    );
    expect(employees.getByRole('button', { name: /Петров С\./ })).not.toHaveTextContent(
      /растёт|стабильно|снижается/,
    );

    // Запрошены оба периода: выбранный и семь дней перед ним.
    const asked = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .filter((url) => url.pathname === '/api/v1/quality/summary');
    expect(asked.some(earlier)).toBe(true);
    expect(asked.some((url) => !earlier(url))).toBe(true);
  });

  it('календарь ставит границу периода и не даёт его перевернуть', async () => {
    respond(SCREEN_ROUTES);
    const seen = vi.fn();
    withQueries(<Harness initial={state()} seen={seen} />);

    // Открывается на месяце выбранной даты; видны обе границы периода.
    await userEvent.click(await screen.findByRole('button', { name: 'Период с 14.09.2026' }));
    const calendar = within(screen.getByRole('dialog', { name: 'Начало периода' }));
    expect(calendar.getByText('сентябрь 2026')).toBeInTheDocument();
    expect(calendar.getByRole('button', { name: '14.09.2026' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Начало позже конца: конец встаёт на ту же дату, а календарь закрывается.
    await userEvent.click(calendar.getByRole('button', { name: '25.09.2026' }));
    expect(seen).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-09-25', to: '2026-09-25' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Конец выбирается в другом месяце: календарь листается.
    await userEvent.click(await screen.findByRole('button', { name: 'Период по 25.09.2026' }));
    await userEvent.click(screen.getByRole('button', { name: 'Следующий месяц' }));
    await userEvent.click(screen.getByRole('button', { name: '05.10.2026' }));
    expect(seen).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-09-25', to: '2026-10-05' }),
    );
  });

  it('столбец недели ставит период на неделю, кнопка в блоке возвращает прежний', async () => {
    /**
     * Собирает неделю сводки для теста.
     *
     * @param start Понедельник недели.
     * @param correct Сколько звонков недели полностью корректны.
     * @returns Неделя на два звонка.
     */
    const week = (start: string, correct: number) => ({
      week_start: start,
      calls: 2,
      fully_correct: correct,
      fully_correct_share: correct / 2,
      average_score: 70,
      buckets: { good: 1, fair: 0, poor: 1 },
    });
    respond({
      ...SCREEN_ROUTES,
      '/api/v1/quality/summary': () =>
        json({ ...SUMMARY, weeks: [week('2026-09-07', 0), week('2026-09-14', 1)] }),
    });
    const seen = vi.fn();
    // Период начинается с четверга: первая неделя в нём неполная.
    withQueries(<Harness initial={state({ from: '2026-09-10', to: '2026-09-20' })} seen={seen} />);

    const name = 'Полностью корректные звонки по неделям';
    await screen.findByRole('region', { name });
    /**
     * Находит блок недель на экране.
     *
     * @returns Запросы Testing Library внутри блока.
     */
    const weeks = () => within(screen.getByRole('region', { name }));
    expect(weeks().queryByRole('button', { name: /к периоду/ })).not.toBeInTheDocument();
    // Столбец неполной недели ведёт на её часть внутри периода, а не на семь дней.
    await userEvent.click(weeks().getByRole('button', { name: /Неделя 10\.09–13\.09/ }));
    expect(seen).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-09-10', to: '2026-09-13' }),
    );

    await userEvent.click(await screen.findByRole('button', { name: '← к периоду 10.09–20.09' }));
    expect(seen).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-09-10', to: '2026-09-20' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /к периоду/ })).not.toBeInTheDocument(),
    );
  });

  it('звонки вне скрипта — отдельный список с причиной вместо балла', async () => {
    const fetchMock = respond(SCREEN_ROUTES);
    withQueries(<Harness initial={state({ bucket: 'poor' })} />);

    await userEvent.click(await screen.findByRole('button', { name: /Не по скрипту/ }));

    const list = lastRequest(fetchMock, '/api/v1/quality/calls');
    // Балла у таких звонков нет, и отбор по нему снят, а не оставлен пустым списком.
    expect([list.get('applies'), list.has('bucket')]).toEqual(['false', false]);
    expect(
      await screen.findByText('Обращение в поддержку по оплате, а не продажа.'),
    ).toBeInTheDocument();
    expect(screen.getByText('вне скрипта — не оценивался')).toBeInTheDocument();
  });

  it('сотрудник из адреса остаётся в списке, даже если звонков у него нет', async () => {
    respond(SCREEN_ROUTES);
    withQueries(<Harness initial={state({ operator: 'op-9' })} />);

    const option = await screen.findByRole('option', { name: /Выбранный сотрудник — нет/ });
    expect(option).toHaveValue('op-9');
    expect(screen.getByLabelText('Сотрудники')).toHaveValue('op-9');
  });

  it('отказ сервиса назван, а не показан пустым экраном', async () => {
    respond({ '/api/v1/quality/summary': () => json({ detail: 'forbidden' }, 403) });
    withQueries(<Harness initial={state()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет права на оценки звонков.');
  });
});

describe('разбор звонка', () => {
  const REVIEW_ROUTES = {
    ...SCREEN_ROUTES,
    [`/api/v1/calls/${POOR_ID}`]: () => json(CALL),
    [`/api/v1/calls/${POOR_ID}/quality`]: () => json(EVALUATION),
    [`/api/v1/calls/${GOOD_ID}`]: () => json({ ...CALL, call_id: GOOD_ID }),
    [`/api/v1/calls/${GOOD_ID}/quality`]: () => json({ ...EVALUATION, call_id: GOOD_ID }),
  };

  it('строка списка открывает разбор, а метка времени включает запись с реплики', async () => {
    respond(REVIEW_ROUTES);
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const setTime = vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set');
    const seen = vi.fn();
    withQueries(<Harness initial={state()} seen={seen} />);

    const list = within(await screen.findByRole('region', { name: 'Звонки' }));
    await userEvent.click(await list.findByRole('button', { name: /60%/ }));
    expect(seen).toHaveBeenLastCalledWith(state({ call: POOR_ID }));

    const review = within(await screen.findByRole('complementary', { name: 'Разбор звонка' }));
    expect(await review.findByText('Не сказал про паспорт.')).toBeInTheDocument();
    expect(review.getByText('нарушено обязательное условие')).toBeInTheDocument();

    // Возражение ведёт и к реплике клиента, и к ответу оператора.
    await userEvent.click(review.getByRole('button', { name: '1:05' }));
    expect(setTime).toHaveBeenLastCalledWith(65);
    expect(play).toHaveBeenCalled();
    expect(review.getByRole('button', { name: /У меня дешевле/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(review.getByRole('button', { name: /Понятно, до свидания/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(review.getByRole('button', { name: /Добрый день/ })).not.toHaveAttribute('aria-current');
  });

  it('листается по списку и закрывается', async () => {
    respond(REVIEW_ROUTES);
    const seen = vi.fn();
    withQueries(<Harness initial={state({ call: POOR_ID })} seen={seen} />);

    const review = within(await screen.findByRole('complementary', { name: 'Разбор звонка' }));
    expect(await review.findByText('Почти по скрипту.')).toBeInTheDocument();
    // Первый в списке: назад некуда.
    expect(review.getByRole('button', { name: '← пред.' })).toBeDisabled();
    const next = review.getByRole('button', { name: 'след. →' });
    await vi.waitFor(() => expect(next).toBeEnabled());
    await userEvent.click(next);
    expect(seen).toHaveBeenLastCalledWith(state({ call: GOOD_ID }));

    // Соседний звонок — новый разбор: он последний, вперёд некуда.
    const second = within(await screen.findByRole('complementary', { name: 'Разбор звонка' }));
    expect(await second.findByText('Почти по скрипту.')).toBeInTheDocument();
    expect(second.getByRole('button', { name: 'след. →' })).toBeDisabled();

    await userEvent.keyboard('{Escape}');
    expect(seen).toHaveBeenLastCalledWith(state({ call: '' }));
    expect(screen.queryByRole('complementary', { name: 'Разбор звонка' })).not.toBeInTheDocument();
  });

  it('страница под разбором не прыгает: место полосы прокрутки занято отступом', async () => {
    respond(REVIEW_ROUTES);
    // Окно 1024, содержимое 1009: полоса прокрутки шириной 15 пикселей. Свойство
    // подменяется на самом элементе и снимается руками: `spyOn` на унаследованном
    // геттере после восстановления оставляет геттер, вызывающий сам себя.
    vi.stubGlobal('innerWidth', 1024);
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      get: () => 1009,
    });
    try {
      withQueries(<Harness initial={state({ call: POOR_ID })} />);

      const review = within(await screen.findByRole('complementary', { name: 'Разбор звонка' }));
      expect([document.body.style.overflow, document.body.style.paddingRight]).toEqual([
        'hidden',
        '15px',
      ]);

      await userEvent.click(review.getByRole('button', { name: 'Закрыть разбор' }));
      expect([document.body.style.overflow, document.body.style.paddingRight]).toEqual(['', '']);
    } finally {
      Reflect.deleteProperty(document.documentElement, 'clientWidth');
    }
  });

  it('при включённом движении панель сначала уезжает и только потом исчезает', async () => {
    respond(REVIEW_ROUTES);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const seen = vi.fn();
    withQueries(<Harness initial={state({ call: POOR_ID })} seen={seen} />);

    const panel = await screen.findByRole('complementary', { name: 'Разбор звонка' });
    await within(panel).findByText('Почти по скрипту.');
    await userEvent.keyboard('{Escape}');
    // Закрытие начато, но звонок ещё открыт: панель уезжает.
    expect(seen).not.toHaveBeenCalled();
    expect(panel).toBeInTheDocument();

    // Ожидание библиотеки, а не `vi.waitFor`: закрытие приходит по таймеру, и
    // только она знает, что обновление состояния вне действия здесь ожидаемо.
    await waitFor(() => expect(seen).toHaveBeenLastCalledWith(state({ call: '' })));
    await waitFor(() =>
      expect(
        screen.queryByRole('complementary', { name: 'Разбор звонка' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('звонок вне скрипта показывает причину и разговор, а не пустой чек-лист', async () => {
    respond({
      ...SCREEN_ROUTES,
      [`/api/v1/calls/${POOR_ID}`]: () =>
        json({
          ...CALL,
          audio_status: 'pending',
          segments: SEGMENTS.map((item) => ({ ...item, speaker: 'unknown' })),
        }),
      [`/api/v1/calls/${POOR_ID}/quality`]: () =>
        json({
          ...EVALUATION,
          script_applies: false,
          score: null,
          stages: [],
          objections: [],
          summary: 'Обращение в поддержку.',
        }),
    });
    withQueries(<Harness initial={state({ call: POOR_ID })} />);

    const review = within(await screen.findByRole('complementary', { name: 'Разбор звонка' }));
    expect(
      await review.findByText('Скрипт к звонку не применим: Обращение в поддержку.'),
    ).toBeInTheDocument();
    expect(review.getByText('нет балла')).toBeInTheDocument();
    expect(review.queryByRole('region', { name: 'Этапы скрипта' })).not.toBeInTheDocument();
    expect(review.getByText('Роли оператора и клиента пока не определены.')).toBeInTheDocument();
    expect(review.queryByText(/без разделения каналов/)).not.toBeInTheDocument();
    expect(review.getAllByText('не определён')).toHaveLength(3);
  });

  it('в разборе отказ оценки показывает причину и отсутствие балла', async () => {
    respond({
      [`/api/v1/calls/${POOR_ID}`]: () => json(CALL),
      [`/api/v1/calls/${POOR_ID}/quality`]: () =>
        json({ detail: 'quality_roles_undetermined' }, 404),
    });
    withQueries(<Harness initial={state({ call: POOR_ID })} />);
    const review = within(await screen.findByRole('complementary', { name: 'Разбор звонка' }));
    expect(await review.findByRole('alert')).toHaveTextContent(
      'Не удалось оценить звонок: роли оператора и клиента не определены.',
    );
    expect(review.getByText('нет балла')).toBeInTheDocument();
    expect(review.queryByText('0%')).not.toBeInTheDocument();
  });
});

const FOUND: SearchResponse = {
  contract_version: '2.3',
  mode: 'any_order',
  total_matches: 3,
  total_calls: 2,
  period_calls: 4,
  share: 0.5,
  items: [
    {
      call_id: POOR_ID,
      session_id: 'telphin-1',
      started_at: '2026-09-15T10:00:00Z',
      duration_s: 180,
      match_count: 2,
      operator_login: '13240*901',
      audio_status: 'stored',
      processing_status: 'done',
      segment_source: 'unknown',
      product_source: 'unknown',
      source: 'telphin',
      quality_score: 60,
      quotes: [{ seq: 4, start_ms: 65000, speaker: 'operator', text: 'Нужен паспорт держателя.' }],
    },
    {
      // Найден, но не оценён: балла у него нет.
      call_id: GOOD_ID,
      session_id: 'telphin-2',
      started_at: '2026-09-16T10:00:00Z',
      duration_s: 95,
      match_count: 1,
      operator_login: '13240*902',
      audio_status: 'stored',
      processing_status: 'done',
      segment_source: 'unknown',
      product_source: 'unknown',
      source: 'telphin',
      quality_score: null,
      quotes: [],
    },
  ],
};

/**
 * Проверяет, уходил ли запрос поиска.
 *
 * @param fetchMock Подмена `fetch`.
 * @returns `true`, если среди вызовов есть обращение к ручке поиска.
 */
function searched(fetchMock: ReturnType<typeof respond>): boolean {
  return fetchMock.mock.calls.some(
    ([input]) => new URL(String(input)).pathname === '/api/v1/search',
  );
}

describe('поиск по словам', () => {
  it('ищет в охвате экрана и показывает балл найденного звонка', async () => {
    const fetchMock = respond({ ...SCREEN_ROUTES, '/api/v1/search': () => json(FOUND) });
    withQueries(<Harness initial={state({ q: 'паспорт', operator: 'op-1' })} />);

    const block = await screen.findByRole('region', { name: 'Поиск по словам' });
    expect(
      await within(block).findByText('Найдено 3 совпадения в 2 разговорах'),
    ).toBeInTheDocument();

    // Те же слова и тот же охват, что у сводки, среди звонков, которые оцениваются.
    const query = lastRequest(fetchMock, '/api/v1/search');
    expect(query.get('q')).toBe('паспорт');
    expect(query.get('source')).toBe('telphin');
    expect(query.get('operator_id')).toBe('op-1');
    // Сутки периода в зоне показа (Москва), верхняя граница — начало следующих.
    expect(query.get('from')).toBe('2026-09-13T21:00:00.000Z');
    expect(query.get('to')).toBe('2026-09-20T21:00:00.000Z');

    // Балл — только у оценённого.
    const cards = within(block).getAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(within(cards[0] as HTMLElement).getByText('60%')).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).queryByText(/%$/)).not.toBeInTheDocument();

    // Карточка открывает разговор здесь же, цитата — на своей секунде.
    const links = within(cards[0] as HTMLElement).getAllByRole('link');
    const opened = new URL(links[0]?.getAttribute('href') ?? '', 'http://speech');
    expect(opened.pathname).toBe('/quality');
    expect(opened.searchParams.get('hit')).toBe(POOR_ID);
    expect(opened.searchParams.get('q')).toBe('паспорт');
    const quote = new URL(links[1]?.getAttribute('href') ?? '', 'http://speech');
    expect(quote.searchParams.get('t')).toBe('65');

    expect(within(block).getByText(/Выберите разговор слева/)).toBeInTheDocument();
  });

  it('без запроса не ищет, а после ввода — ищет и запоминает запрос', async () => {
    const fetchMock = respond({ ...SCREEN_ROUTES, '/api/v1/search': () => json(FOUND) });
    const seen = vi.fn();
    withQueries(<Harness initial={state()} seen={seen} />);

    const block = await screen.findByRole('region', { name: 'Поиск по словам' });
    expect(within(block).getByText(/Введите слово или фразу/)).toBeInTheDocument();
    expect(searched(fetchMock)).toBe(false);

    await userEvent.type(
      within(block).getByRole('textbox', { name: 'Слова для поиска в разговорах' }),
      ' паспорт ',
    );
    await userEvent.click(within(block).getByRole('button', { name: 'Найти' }));

    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'паспорт', hit: '' }));
    expect(await within(block).findByText('60%')).toBeInTheDocument();
    expect(lastRequest(fetchMock, '/api/v1/search').get('q')).toBe('паспорт');
  });

  it('пустая выдача названа, а не показана пустым местом', async () => {
    respond({
      ...SCREEN_ROUTES,
      '/api/v1/search': () => json({ ...FOUND, total_matches: 0, total_calls: 0, items: [] }),
    });
    withQueries(<Harness initial={state({ q: 'роуминг' })} />);

    const block = await screen.findByRole('region', { name: 'Поиск по словам' });
    expect(
      await within(block).findByText(/По запросу «роуминг» совпадений нет/),
    ).toBeInTheDocument();
  });

  it('среди звонков без оператора не ищет и говорит почему', async () => {
    const fetchMock = respond({ ...SCREEN_ROUTES, '/api/v1/search': () => json(FOUND) });
    withQueries(<Harness initial={state({ q: 'паспорт', operator: UNASSIGNED })} />);

    const block = await screen.findByRole('region', { name: 'Поиск по словам' });
    expect(
      within(block).getByText(/Среди звонков без оператора поиск не работает/),
    ).toBeInTheDocument();
    expect(searched(fetchMock)).toBe(false);
  });
});
