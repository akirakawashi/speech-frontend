import type { QualityOperatorScore } from '../api/types';
import { UNASSIGNED } from './state';

/**
 * Называет сотрудника в списке и фильтре.
 *
 * @param operator Сотрудник из сводки.
 * @returns Полное имя, а без него — логин; «Без оператора», если нет ничего.
 */
export function operatorLabel(operator: Pick<QualityOperatorScore, 'full_name' | 'login'>): string {
  return operator.full_name || operator.login || 'Без оператора';
}

/**
 * Определяет ключ сотрудника для фильтра: звонки без оператора — `UNASSIGNED`.
 *
 * @param operator Сотрудник из сводки.
 * @returns Идентификатор сотрудника или `UNASSIGNED`.
 */
export function operatorKey(operator: Pick<QualityOperatorScore, 'operator_id'>): string {
  return operator.operator_id ?? UNASSIGNED;
}
