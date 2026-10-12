import type { CallSource } from '@/entities/call';
import { EMPTY_STATE, type SearchState } from '@/features/call-search';
import { dayStartInstant, nextDay } from '@/shared/lib/date';
import type { QualityState } from './state';
import { UNASSIGNED } from './state';

type ApiQuery = Record<string, string | boolean | undefined>;

/**
 * Собирает параметры охвата сводки: период и сотрудник.
 *
 * Границы — начало суток в зоне показа, верхняя — начало **следующих** суток:
 * так же, как у поиска, иначе один и тот же день на двух экранах значил бы
 * разные звонки.
 *
 * @param state Состояние экрана: период и сотрудник.
 * @param timeZone Часовой пояс показа: в нём считаются границы суток.
 * @returns Параметры запроса; незаданные — `undefined`.
 */
export function scopeQuery(
  state: Pick<QualityState, 'from' | 'to' | 'operator'>,
  timeZone: string,
): ApiQuery {
  return {
    from: state.from ? dayStartInstant(state.from, timeZone) : undefined,
    to: state.to ? dayStartInstant(nextDay(state.to), timeZone) : undefined,
    operator_id: state.operator && state.operator !== UNASSIGNED ? state.operator : undefined,
    unassigned: state.operator === UNASSIGNED ? true : undefined,
  };
}

/**
 * Собирает параметры запроса списка звонков: охват плюс отбор и порядок.
 *
 * @param state Состояние экрана.
 * @param timeZone Часовой пояс показа.
 * @returns Параметры запроса списка.
 */
export function callsQuery(state: QualityState, timeZone: string): ApiQuery {
  const scope = scopeQuery(state, timeZone);
  if (state.evaluationStatus) {
    return { ...scope, evaluation_status: state.evaluationStatus, sort: 'newest' };
  }
  // У звонков вне скрипта балла нет — упорядочить их можно только по времени.
  if (state.skipped) return { ...scope, applies: false, sort: 'newest' };
  return {
    ...scope,
    bucket: state.bucket || undefined,
    stage: state.stage || undefined,
    stage_state: state.stage ? state.stageResult : undefined,
    outcome: state.outcome || undefined,
    violations: state.violations ? true : undefined,
    sort: state.sort,
  };
}

/**
 * Чьи звонки оцениваются по скрипту. Совпадает с источником скрипта на сервере
 * (`CallScript.source`): поиск на экране оценки идёт по тем же звонкам, что и
 * сводка, иначе в выдаче стояли бы разговоры, которым балл не положен.
 */
export const QUALITY_SOURCE: CallSource = 'telphin';

/**
 * Строит запрос блока «Поиск по словам» в форме поиска диалогов: те же слова, тот же охват, что у
 * сводки, — период и сотрудник.
 *
 * `null` — искать нельзя: у поиска нет отбора «без оператора», а выдача по
 * всем сотрудникам под фильтром «Без оператора» была бы чужой.
 *
 * @param state Состояние экрана: запрос, период и сотрудник.
 * @returns Состояние поиска или `null`, если искать нельзя.
 */
export function qualitySearch(
  state: Pick<QualityState, 'q' | 'from' | 'to' | 'operator'>,
): SearchState | null {
  if (state.operator === UNASSIGNED) return null;
  return {
    ...EMPTY_STATE,
    source: QUALITY_SOURCE,
    q: state.q,
    from: state.from,
    to: state.to,
    operatorId: state.operator,
  };
}
