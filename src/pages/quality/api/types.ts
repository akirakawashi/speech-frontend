import type { Schemas } from '@/shared/api';

/** Сводка оценок за период: разряды, этапы, возражения, итоги, сотрудники и недели. */
export type QualitySummaryResponse = Schemas['QualitySummaryResponse'];
/** Этап скрипта в сводке: сколько раз был нужен и сколько раз не выполнен. */
export type QualityStageShare = Schemas['QualityStageShare'];
/** Тип возражения в сводке: сколько раз звучало и сколько раз отработано. */
export type QualityObjectionShare = Schemas['QualityObjectionShare'];
/** Итог звонка в сводке: число звонков и их доля. */
export type QualityOutcomeShare = Schemas['QualityOutcomeShare'];
/** Сотрудник в сводке: число оценённых звонков и средний балл. */
export type QualityOperatorScore = Schemas['QualityOperatorScore'];
/** Страница списка оценённых звонков. */
export type QualityCallsResponse = Schemas['QualityCallsResponse'];
/** Звонок в списке: балл, разряд, этапы и состояние оценки. */
export type QualityCallItem = Schemas['QualityCallItem'];
