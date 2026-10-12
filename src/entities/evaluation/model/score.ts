export type ScoreTone = 'good' | 'fair' | 'poor';

/**
 * Относит балл к разряду шкалы оценки: те же пороги, что у разрядов звонков, — 85 и 70.
 *
 * @param score Балл от 0 до 100.
 * @returns `good` — от 85, `fair` — от 70, `poor` — ниже.
 */
export function scoreTone(score: number): ScoreTone {
  if (score >= 85) return 'good';
  if (score >= 70) return 'fair';
  return 'poor';
}
