import { describe, expect, it } from 'vitest';
import {
  defaultReportFilters,
  type ReportFilters,
  reportFilename,
  reportPeriodError,
  reportQuery,
  reportRefusalText,
} from '@/lib/report';

const BASE: ReportFilters = {
  source: 'ncc',
  from: '2026-09-01',
  to: '2026-09-15',
  operatorId: '',
  operatorNodeId: '',
  aiNodeId: '',
};

describe('отчёт в Excel (SP-604)', () => {
  it('по умолчанию — семь дней, включая сегодняшний', () => {
    expect(defaultReportFilters(new Date('2026-09-15T10:00:00Z'))).toEqual({
      ...BASE,
      from: '2026-09-09',
    });
  });

  it('в адрес уходят только заданные фильтры', () => {
    const query = reportQuery({ ...BASE, operatorNodeId: 'n1', aiNodeId: 'n2' });

    expect(Object.fromEntries(query)).toEqual({
      from: '2026-09-01',
      to: '2026-09-15',
      source: 'ncc',
      operator_node_id: 'n1',
      ai_node_id: 'n2',
    });
  });

  it('источник уходит всегда: отчёт Телфина — выбором в форме, а не правкой адреса (S-35)', () => {
    expect(reportQuery(BASE).get('source')).toBe('ncc');
    expect(reportQuery({ ...BASE, source: 'telphin' }).get('source')).toBe('telphin');
  });

  it('период проверяется до запроса', () => {
    expect(reportPeriodError({ ...BASE, from: '' })).toBe('Укажи обе даты периода.');
    expect(reportPeriodError({ ...BASE, from: '2026-09-15', to: '2026-09-01' })).toBe(
      'Конец периода раньше начала.',
    );
    expect(reportPeriodError(BASE)).toBeNull();
    expect(reportPeriodError({ ...BASE, from: '2026-09-15', to: '2026-09-15' })).toBeNull();
  });
});

describe('отказ сервера словами (S-31)', () => {
  it('занятый сборкой отчёт и слишком длинный период называются прямо', () => {
    expect(reportRefusalText(429, 'report_busy')).toBe(
      'Отчёт уже собирается — повтори через минуту.',
    );
    expect(reportRefusalText(422, 'report_too_large: 18000 calls, limit 15000')).toBe(
      'За период 18000 звонков, в отчёт помещается 15000 — сузь период.',
    );
    expect(reportRefusalText(500, '')).toBe('Отчёт не собран: сервер ответил 500.');
  });

  it('имя файла — из ответа сервера, иначе из периода', () => {
    expect(
      reportFilename('attachment; filename="speech-report-2026-09-18_2026-09-24.xlsx"', BASE),
    ).toBe('speech-report-2026-09-18_2026-09-24.xlsx');
    expect(reportFilename(null, BASE)).toBe('speech-report-2026-09-01_2026-09-15.xlsx');
  });

  it('запасное имя отчёта Телфина — как у сервера, не затирает отчёт NCC', () => {
    expect(reportFilename(null, { ...BASE, source: 'telphin' })).toBe(
      'speech-report-telphin-2026-09-01_2026-09-15.xlsx',
    );
  });
});
