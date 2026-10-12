import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewFile } from './ReviewFile';

const can = vi.fn<(permission: string) => boolean>();

vi.mock('@/lib/session', () => ({
  PERM_EXPORT: 'export',
  useSession: () => ({ status: 'ready', can }),
}));

const WEEK = { from: '2026-09-14', to: '2026-09-20', operator: 'op-1' };
const NAME = 'quality-review-2026-09-14_2026-09-20.xlsx';

/** Подменить сеть и сохранение файла; вернуть то, что браузер «сохранил». */
function browser(response: () => Response) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response());
  vi.stubGlobal('fetch', fetchMock);
  URL.createObjectURL = vi.fn(() => 'blob:review');
  URL.revokeObjectURL = vi.fn();
  const saved: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push(this.download);
  });
  return { fetchMock, saved };
}

function file(): Response {
  return new Response(new Blob(['xlsx']), {
    status: 200,
    headers: { 'Content-Disposition': `attachment; filename="${NAME}"` },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('кнопка «Выгрузить для проверки»', () => {
  it('без права на выгрузку кнопки нет: сервер всё равно отказал бы', () => {
    can.mockReturnValue(false);
    render(<ReviewFile state={WEEK} available />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('скачивает файл охвата под именем, которое дал сервер', async () => {
    can.mockImplementation((permission) => permission === 'export');
    const { fetchMock, saved } = browser(file);
    render(<ReviewFile state={WEEK} available />);

    await userEvent.click(screen.getByRole('button', { name: 'Выгрузить для проверки' }));

    await waitFor(() => expect(saved).toEqual([NAME]));
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(input), 'http://speech');
    expect(url.pathname).toBe('/api/v1/quality/review.xlsx');
    expect(url.searchParams.get('operator_id')).toBe('op-1');
    expect(url.searchParams.get('from')).toBe('2026-09-13T21:00:00.000Z');
    // Личность несёт кука сессии: без неё сервер ответил бы `401`.
    expect(init).toEqual({ credentials: 'same-origin' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('отказ сервера показывает словами и ничего не сохраняет', async () => {
    can.mockReturnValue(true);
    const { saved } = browser(
      () =>
        new Response(JSON.stringify({ detail: 'nothing_to_review' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    render(<ReviewFile state={WEEK} available />);

    await userEvent.click(screen.getByRole('button', { name: 'Выгрузить для проверки' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'За период нет звонков, оценённых по скрипту: сверять нечего.',
    );
    expect(saved).toEqual([]);
    // Кнопка снова доступна: отказ — не тупик.
    expect(screen.getByRole('button', { name: 'Выгрузить для проверки' })).toBeEnabled();
  });

  it('пока в охвате нет оценённых звонков, кнопка выключена и говорит почему', () => {
    can.mockReturnValue(true);
    render(<ReviewFile state={WEEK} available={false} />);

    const button = screen.getByRole('button', { name: 'Выгрузить для проверки' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'За период нет звонков, оценённых по скрипту');
  });
});
