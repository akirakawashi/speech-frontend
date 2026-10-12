/**
 * Собирает реплики, на которых основан вердикт по возражению.
 *
 * Это реплика клиента с возражением и ответ оператора — по порядку разговора и
 * без повторов: модель иногда называет одну и ту же реплику дважды.
 *
 * @param seq Номер реплики клиента с возражением; `null` или `undefined` — модель её не указала.
 * @param evidence Номера реплик, на которые сослалась модель.
 * @returns Номера реплик по возрастанию, каждая один раз.
 */
export function objectionSeqs(
  seq: number | null | undefined,
  evidence: readonly number[] | undefined,
): number[] {
  const all = [...(seq === null || seq === undefined ? [] : [seq]), ...(evidence ?? [])];
  return [...new Set(all)].sort((a, b) => a - b);
}
