import type { QualityObjectionShare } from '../api/types';

/**
 * Карточки возражений из макета заказчика: шесть типов, по которым он смотрит
 * отработку. В скрипте («РСВ») типов больше: «подумаю» там в двух вариантах —
 * с проверенной технической возможностью и без, — и это одна карточка.
 */
const OBJECTION_CARDS: readonly { key: string; label: string; types: readonly string[] }[] = [
  { key: 'not_interested', label: 'Не интересно', types: ['not_interested'] },
  { key: 'has_everything', label: 'У меня всё есть / всё устраивает', types: ['has_everything'] },
  { key: 'cheaper', label: 'Мой тариф/провайдер выгоднее', types: ['cheaper'] },
  {
    key: 'think',
    label: 'Надо подумать / посоветоваться',
    types: ['think_checked', 'think_unchecked'],
  },
  { key: 'self_service', label: 'Сам обращусь в офис / на сайте', types: ['self_service'] },
  { key: 'bad_mobile', label: 'Жалоба на плохую связь', types: ['bad_mobile'] },
];

/** Ключ карточки для возражений, которых в макете нет. */
export const OTHER_OBJECTIONS = 'other';

export type ObjectionCard = {
  key: string;
  label: string;
  raised: number;
  handled: number;
  /** Доля отработанных. `null` — возражение не звучало: это не 0% и не 100%. */
  share: number | null;
  /** Из чего сложена карточка «Прочие»: только то, что звучало. */
  parts: readonly { type: string; label: string; raised: number; handled: number }[];
};

/**
 * Раскладывает возражения периода по карточкам макета.
 *
 * Последняя — «Прочие»: всё, чего в шести карточках нет. Так тип, добавленный в скрипт позже, не
 * пропадает с экрана молча, а сумма карточек равна числу возражений периода.
 *
 * @param objections Возражения из сводки: сколько раз звучали и сколько раз отработаны.
 * @returns Шесть карточек макета и последняя — «Прочие».
 */
export function objectionCards(objections: readonly QualityObjectionShare[]): ObjectionCard[] {
  const byType = new Map(objections.map((item) => [item.type, item]));
  const named = new Set(OBJECTION_CARDS.flatMap((card) => card.types));
  /**
   * Складывает возражения одной карточки.
   *
   * @param items Возражения, вошедшие в карточку.
   * @returns Сколько раз звучали, сколько раз отработаны и доля отработки; `null` вместо доли, если
   *   не звучали.
   */
  const sum = (items: readonly QualityObjectionShare[]) => {
    const raised = items.reduce((total, item) => total + item.raised, 0);
    const handled = items.reduce((total, item) => total + item.handled, 0);
    return { raised, handled, share: raised > 0 ? handled / raised : null };
  };
  const cards: ObjectionCard[] = OBJECTION_CARDS.map((card) => ({
    key: card.key,
    label: card.label,
    ...sum(card.types.flatMap((type) => byType.get(type) ?? [])),
    parts: [],
  }));
  const rest = objections.filter((item) => !named.has(item.type));
  cards.push({
    key: OTHER_OBJECTIONS,
    label: 'Прочие',
    ...sum(rest),
    parts: rest
      .filter((item) => item.raised > 0)
      .map(({ type, label, raised, handled }) => ({ type, label, raised, handled })),
  });
  return cards;
}
