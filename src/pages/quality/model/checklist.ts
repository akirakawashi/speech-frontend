import {
  type CallQualityResponse,
  objectionSeqs,
  STAGE_STATE_LABEL,
  type StageState,
  stageState,
} from '@/entities/evaluation';

/** Пункт чек-листа в разборе звонка: этап скрипта или возражение клиента. */
export type ChecklistItem = {
  id: string;
  num: string;
  label: string;
  state: StageState;
  /** Состояние словами — для подсказки и для тех, кто не видит знак. */
  verdict: string;
  mandatory: boolean;
  comment: string;
  /** Реплики, на которых основан вердикт. */
  seqs: number[];
};

/**
 * Раскладывает оценку звонка на пункты чек-листа.
 *
 * @param quality Оценка звонка; `undefined` — оценки нет или она не загрузилась.
 * @returns Этапы скрипта и возражения клиента; оба списка пустые, если скрипт к звонку не применим.
 */
export function checklist(quality: CallQualityResponse | undefined): {
  stages: ChecklistItem[];
  objections: ChecklistItem[];
} {
  if (!quality?.script_applies) return { stages: [], objections: [] };
  const stages = (quality.stages ?? []).map((stage, index): ChecklistItem => {
    const state = stageState(stage);
    return {
      id: `stage:${stage.key}`,
      num: String(index + 1).padStart(2, '0'),
      label: stage.label,
      state,
      verdict: STAGE_STATE_LABEL[state],
      mandatory: stage.mandatory,
      comment: stage.comment ?? '',
      seqs: stage.evidence ?? [],
    };
  });
  const objections = (quality.objections ?? []).map((item, index): ChecklistItem => {
    return {
      id: `objection:${index}`,
      num: '',
      label: item.label,
      state: item.handled ? 'done' : 'failed',
      verdict: item.handled ? 'отработано' : 'не отработано',
      mandatory: false,
      comment: item.comment ?? '',
      seqs: objectionSeqs(item.seq, item.evidence),
    };
  });
  return { stages, objections };
}

/**
 * Собирает реплики, на которые ссылаются невыполненные пункты.
 *
 * Такие реплики отмечены в разговоре сразу: плохое место видно, не выбирая этап.
 *
 * @param items Пункты чек-листа: этапы и возражения вместе.
 * @returns Номера реплик невыполненных пунктов.
 */
export function flaggedSeqs(items: readonly ChecklistItem[]): Set<number> {
  const seqs = new Set<number>();
  for (const item of items) {
    if (item.state === 'failed') for (const seq of item.seqs) seqs.add(seq);
  }
  return seqs;
}
