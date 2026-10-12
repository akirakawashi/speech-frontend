import type { Schemas } from '@/shared/api';

/** Оценка звонка по скрипту: балл, этапы, возражения и итог. */
export type CallQualityResponse = Schemas['CallQualityResponse'];
/** Этап скрипта в оценке одного звонка. */
export type QualityStageModel = Schemas['QualityStageModel'];
/** Возражение клиента в оценке одного звонка. */
export type QualityObjectionModel = Schemas['QualityObjectionModel'];
