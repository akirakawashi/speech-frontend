import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { SegmentModel } from '@/entities/call';
import type { CallQualityResponse } from '@/entities/evaluation';
import { QualityBlock } from './QualityBlock';

const SEGMENTS: SegmentModel[] = [
  { seq: 0, speaker: 'operator', start_ms: 3_000, end_ms: 5_000, text: 'Добрый день' },
  { seq: 1, speaker: 'client', start_ms: 65_000, end_ms: 70_000, text: 'У меня дешевле' },
  { seq: 2, speaker: 'operator', start_ms: 71_000, end_ms: 74_000, text: 'Понятно, до свидания' },
];

const EVALUATION: CallQualityResponse = {
  contract_version: '2.1',
  call_id: 'call-1',
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
 * Отрисовывает разметку внутри своего кэша запросов.
 *
 * @param node Разметка под тестом.
 * @returns Результат отрисовки Testing Library.
 */
function withQueries(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe('оценка в карточке разговора', () => {
  it('отказ определения ролей показывает причину без нулевого балла', async () => {
    respond({
      '/api/v1/calls/call-1/quality': () => json({ detail: 'quality_roles_undetermined' }, 404),
    });
    withQueries(<QualityBlock callId="call-1" segments={SEGMENTS} onSeek={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось оценить звонок: роли оператора и клиента не определены.',
    );
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('вердикты ведут к репликам, неприменимый этап помечен прочерком', async () => {
    respond({ '/api/v1/calls/call-1/quality': () => json(EVALUATION) });
    const onSeek = vi.fn();
    withQueries(<QualityBlock callId="call-1" segments={SEGMENTS} onSeek={onSeek} />);

    expect(await screen.findByText('90%')).toBeInTheDocument();
    expect(screen.getByText('Не сказал про паспорт.')).toBeInTheDocument();
    expect(screen.getByText('чек-лист')).toBeInTheDocument();
    expect(screen.getByTitle('не понадобился — засчитан')).toHaveTextContent('—');

    await userEvent.click(screen.getByRole('button', { name: '0:03' }));
    expect(onSeek).toHaveBeenCalledWith(3);
    // Возражение ведёт к реплике клиента.
    await userEvent.click(screen.getByRole('button', { name: '1:05' }));
    expect(onSeek).toHaveBeenLastCalledWith(65);
  });

  it('у звонка другого источника блока оценки нет: оценён он не будет', async () => {
    respond({
      '/api/v1/calls/call-3/quality': () => json({ detail: 'not_applicable' }, 404),
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <QualityBlock callId="call-3" segments={SEGMENTS} onSeek={() => undefined} />
      </QueryClientProvider>,
    );
    // Пусто и до ответа, поэтому ждём сам отказ и даём блоку перерисоваться:
    // иначе проверка прошла бы, не дождавшись того, что проверяет.
    await waitFor(() => expect(client.getQueryCache().getAll()[0]?.state.status).toBe('error'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container).toBeEmptyDOMElement();
  });

  it('неоценённый звонок — спокойная пометка, а не ошибка', async () => {
    respond({ '/api/v1/calls/call-2/quality': () => json({ detail: 'not_evaluated' }, 404) });
    withQueries(<QualityBlock callId="call-2" segments={SEGMENTS} onSeek={() => undefined} />);
    expect(await screen.findByText('Звонок ещё не оценён.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
