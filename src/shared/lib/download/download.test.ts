import { describe, expect, it } from 'vitest';
import { filenameFrom } from './download';

describe('имя скачиваемого файла', () => {
  it('берётся из ответа сервера', () => {
    const header = 'attachment; filename="quality-review-2026-09-14_2026-09-20.xlsx"';
    expect(filenameFrom(header, 'запасное.xlsx')).toBe('quality-review-2026-09-14_2026-09-20.xlsx');
  });

  it('без заголовка — запасное', () => {
    expect(filenameFrom(null, 'запасное.xlsx')).toBe('запасное.xlsx');
  });
});
