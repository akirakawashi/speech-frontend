import type { QualityOutcomeShare } from '../api/types';

/** Итоги на круговой диаграмме макета, по часовой стрелке. */
export const DONUT_OUTCOMES = ['request', 'callback', 'refusal'] as const;

export type DonutOutcome = (typeof DONUT_OUTCOMES)[number];

export type OutcomeDonut = {
  /** Три части диаграммы: доля от звонков по скрипту и смещение начала дуги. */
  parts: readonly (QualityOutcomeShare & { key: DonutOutcome; offset: number })[];
  /** Итоги, которых на диаграмме нет: «нет технической возможности», «не определено». */
  rest: readonly QualityOutcomeShare[];
};

/**
 * Раскладывает итоги звонков на части круговой диаграммы.
 *
 * Доли — от всех звонков по скрипту, а не от трёх показанных: иначе «заявок 50%» на диаграмме
 * расходилось бы с числом звонков в списке, и остаток круга честно остаётся пустым.
 *
 * @param outcomes Итоги из сводки: число звонков и доля каждого.
 * @returns Три части диаграммы со смещением начала дуги и итоги, которые на диаграмму не идут.
 */
export function outcomeDonut(outcomes: readonly QualityOutcomeShare[]): OutcomeDonut {
  const byKey = new Map(outcomes.map((item) => [item.key, item]));
  let offset = 0;
  const parts = DONUT_OUTCOMES.flatMap((key) => {
    const found = byKey.get(key);
    if (!found) return [];
    const part = { ...found, key, offset };
    offset += found.share;
    return [part];
  });
  const shown = new Set<string>(DONUT_OUTCOMES);
  return { parts, rest: outcomes.filter((item) => !shown.has(item.key)) };
}
