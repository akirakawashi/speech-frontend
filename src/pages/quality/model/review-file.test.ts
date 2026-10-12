import { describe, expect, it } from 'vitest';
import { reviewFilename, reviewHref, reviewRefusalText } from './review-file';
import { UNASSIGNED } from './state';

const WEEK = { from: '2026-09-14', to: '2026-09-20', operator: '' };

/**
 * Достаёт параметры из адреса выгрузки.
 *
 * @param href Адрес выгрузки.
 * @returns Параметры строки запроса.
 */
function query(href: string): URLSearchParams {
  return new URL(href, 'http://speech').searchParams;
}

describe('файл «Сверка оценок»', () => {
  it('просит тот же охват, что и сводка: сутки в поясе колл-центра', () => {
    const href = reviewHref(WEEK, 'Europe/Moscow');

    expect(new URL(href, 'http://speech').pathname).toBe('/api/v1/quality/review.xlsx');
    // Начало суток в Москве — 21:00 UTC накануне; верхняя граница — начало
    // следующих суток, как у сводки.
    expect(query(href).get('from')).toBe('2026-09-13T21:00:00.000Z');
    expect(query(href).get('to')).toBe('2026-09-20T21:00:00.000Z');
    expect([...query(href).keys()].sort()).toEqual(['from', 'to']);
  });

  it('сотрудник и «без сотрудника» уходят так же, как в запросе сводки', () => {
    expect(query(reviewHref({ ...WEEK, operator: 'op-1' }, 'UTC')).get('operator_id')).toBe('op-1');

    const nobody = query(reviewHref({ ...WEEK, operator: UNASSIGNED }, 'UTC'));
    expect(nobody.get('unassigned')).toBe('true');
    expect(nobody.has('operator_id')).toBe(false);
  });

  it('запасное имя файла собирается из периода', () => {
    expect(reviewFilename(WEEK)).toBe('quality-review-2026-09-14_2026-09-20.xlsx');
  });

  it('отказ называется словами, а «нечего сверять» — не сбой', () => {
    expect(reviewRefusalText(404, 'nothing_to_review')).toBe(
      'За период нет звонков, оценённых по скрипту: сверять нечего.',
    );
    expect(reviewRefusalText(403, 'forbidden')).toBe('Нет права на выгрузку.');
    expect(reviewRefusalText(401, '')).toContain('Сессия истекла');
    expect(reviewRefusalText(500, 'boom')).toBe('Файл не собран: сервер ответил 500 (boom).');
    expect(reviewRefusalText(502, '')).toBe('Файл не собран: сервер ответил 502.');
  });
});
