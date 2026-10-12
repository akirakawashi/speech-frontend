import { describe, expect, it } from 'vitest';
import { formatAge } from './format';

describe('formatAge', () => {
  it('отсутствие возраста — это прочерк, а не ноль секунд', () => {
    // Ноль означал бы «только что», а на деле в полосе нет ни одного задания.
    expect(formatAge(null)).toBe('—');
    expect(formatAge(undefined)).toBe('—');
    expect(formatAge(0)).toBe('0 с');
  });

  it('единицы укрупняются: секунды, минуты, часы', () => {
    expect(formatAge(45)).toBe('45 с');
    expect(formatAge(90)).toBe('1 мин');
    expect(formatAge(3600)).toBe('1 ч');
    expect(formatAge(3 * 3600 + 15 * 60)).toBe('3 ч 15 мин');
  });
});
