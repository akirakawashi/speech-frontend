export type StageState = 'done' | 'failed' | 'skipped';

/** Порядок в переключателе над списком: сначала то, ради чего обычно приходят. */
export const STAGE_STATES: readonly StageState[] = ['failed', 'done', 'skipped'];

/**
 * Определяет состояние этапа скрипта в одном звонке.
 *
 * @param stage Этап: был ли нужен в звонке (`applicable`) и засчитан ли (`passed`).
 * @returns `skipped` — не понадобился, `done` — выполнен, `failed` — не выполнен.
 */
export function stageState(stage: { applicable: boolean; passed: boolean }): StageState {
  if (!stage.applicable) return 'skipped';
  return stage.passed ? 'done' : 'failed';
}

export const STAGE_STATE_LABEL: Record<StageState, string> = {
  done: 'выполнен',
  failed: 'не выполнен',
  skipped: 'не понадобился',
};
