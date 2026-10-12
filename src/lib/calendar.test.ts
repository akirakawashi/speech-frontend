import { describe, expect, it } from 'vitest';
import { monthGrid, monthLabel, monthOf, shiftMonth, WEEKDAYS } from '@/lib/calendar';

describe('календарь', () => {
  it('сетка — шесть недель с понедельника', () => {
    // 1 сентября 2026 — вторник: сетка начинается с понедельника 31 августа.
    const grid = monthGrid('2026-09');
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-08-31');
    expect(grid[1]).toBe('2026-09-01');
    expect(grid.at(-1)).toBe('2026-10-11');
    expect(WEEKDAYS[0]).toBe('Пн');
  });

  it('месяц, начинающийся с понедельника, не получает пустой недели сверху', () => {
    // 1 июня 2026 — понедельник.
    expect(monthGrid('2026-06')[0]).toBe('2026-06-01');
  });

  it('месяц, начинающийся с воскресенья, начинает сетку шестью днями раньше', () => {
    // 1 ноября 2026 — воскресенье.
    expect(monthGrid('2026-11')[0]).toBe('2026-10-26');
    expect(monthGrid('2026-11')[6]).toBe('2026-11-01');
  });

  it('переход между месяцами проходит через границу года', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-09', -3)).toBe('2026-06');
  });

  it('подпись и месяц суток', () => {
    expect(monthLabel('2026-09')).toBe('сентябрь 2026');
    expect(monthOf('2026-09-14')).toBe('2026-09');
  });
});
