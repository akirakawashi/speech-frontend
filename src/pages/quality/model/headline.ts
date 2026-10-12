import { formatCount } from '@/shared/lib/format';
import type { QualitySummaryResponse } from '../api/types';
import { weakestStage } from './stages';

/**
 * Собирает картину периода одной фразой.
 *
 * Считается здесь из тех же чисел, что на экране, а не пишется моделью: итог,
 * расходящийся с графиком под ним, хуже его отсутствия.
 *
 * @param summary Сводка оценок за период.
 * @returns Несколько предложений: сколько звонков по скрипту, какой этап выполняют реже всего и
 *   сколько нарушений.
 */
export function headline(summary: QualitySummaryResponse): string {
  const calls = summary.calls;
  if (!calls) return 'За период нет звонков, оценённых по скрипту.';
  const { poor, good } = summary.buckets;
  const sentences = [
    `Из ${formatCount(calls, 'звонка', 'звонков', 'звонков')} по скрипту ` +
      `плохих — ${poor}, хороших — ${good}.`,
  ];
  const stage = weakestStage(summary.stages ?? []);
  sentences.push(
    stage
      ? `Чаще всего не выполняют этап «${stage.label}»: ${stage.failed} из ` +
          `${formatCount(stage.applicable, 'звонка', 'звонков', 'звонков')}, где он был нужен.`
      : 'Все этапы выполнены везде, где были нужны.',
  );
  if (summary.violations > 0) {
    sentences.push(
      `Обязательное условие не выполнено в ${formatCount(
        summary.violations,
        'звонке',
        'звонках',
        'звонках',
      )}.`,
    );
  }
  return sentences.join(' ');
}
