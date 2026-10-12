/**
 * Раскладывает этап за период на три числа.
 *
 * Не понадобившийся этап засчитан в балл звонка (правило заказчика), но выполненным он от этого не
 * становится — здесь они разведены.
 *
 * @param stage Этап сводки: в скольких звонках встречался, был нужен и не выполнен.
 * @returns Сколько раз выполнен, не выполнен и не понадобился.
 */
export function stageCounts(stage: { calls: number; applicable: number; failed: number }): {
  done: number;
  failed: number;
  skipped: number;
} {
  return {
    done: Math.max(0, stage.applicable - stage.failed),
    failed: stage.failed,
    skipped: Math.max(0, stage.calls - stage.applicable),
  };
}

/**
 * Считает долю выполнения этапа там, где он был нужен.
 *
 * `null` — не был нужен ни разу: это не 0% и не 100%, и показывать его числом значило бы выдумать
 * оценку.
 *
 * @param applicable В скольких звонках этап был нужен.
 * @param failed В скольких из них он не выполнен.
 * @returns Доля от 0 до 1 или `null`, если этап не был нужен ни разу.
 */
export function doneShare(applicable: number, failed: number): number | null {
  if (applicable <= 0) return null;
  return Math.max(0, applicable - failed) / applicable;
}

type StageLike = { label: string; applicable: number; failed: number };

/**
 * Находит этап, который чаще всего не выполняют там, где он нужен.
 *
 * При равной доле — тот, где невыполненных больше: «два из четырёх» весомее, чем «один из двух».
 * Дальше — раньший по скрипту: этапы идут в порядке разговора, и провал в начале объясняет
 * провалы после него. `null` — невыполненных нет.
 *
 * @param stages Этапы в порядке скрипта.
 * @returns Самый слабый этап или `null`, если невыполненных нет.
 */
export function weakestStage<T extends StageLike>(stages: readonly T[]): T | null {
  let weakest: T | null = null;
  let lowest = 1;
  for (const stage of stages) {
    const share = doneShare(stage.applicable, stage.failed);
    if (share === null || stage.failed === 0) continue;
    if (weakest === null || share < lowest || (share === lowest && stage.failed > weakest.failed)) {
      weakest = stage;
      lowest = share;
    }
  }
  return weakest;
}
