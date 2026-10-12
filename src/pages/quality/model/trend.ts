export type Trend = 'up' | 'flat' | 'down';

/**
 * На сколько пунктов должен измениться средний балл, чтобы это считалось
 * движением. Меньше — «стабильно»: у сотрудника с десятком звонков один
 * разговор сдвигает средний балл на пару пунктов и без всякой динамики.
 *
 * В макете заказчика правила нет, там выдуманные данные. Порог наш.
 */
export const TREND_THRESHOLD = 3;

/**
 * Определяет динамику балла к предыдущему периоду.
 *
 * `null` — сравнивать не с чем: в предыдущем периоде у сотрудника не было оценённых звонков.
 *
 * @param current Средний балл за выбранный период.
 * @param previous Средний балл за предыдущий период; `undefined` — оценённых звонков не было.
 * @returns `up`, `down` или `flat`; `null`, если сравнивать не с чем.
 */
export function trendOf(current: number, previous: number | undefined): Trend | null {
  if (previous === undefined) return null;
  const delta = current - previous;
  if (delta > TREND_THRESHOLD) return 'up';
  if (delta < -TREND_THRESHOLD) return 'down';
  return 'flat';
}

export const TREND_LABEL: Record<Trend, string> = {
  up: '↑ растёт',
  flat: '→ стабильно',
  down: '↓ снижается',
};

/** Баллы сотрудников за предыдущий период той же длины: ключ сотрудника → средний балл. */
export type PreviousScores = { label: string; scores: ReadonlyMap<string, number> };
