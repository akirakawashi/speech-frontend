import type { SegmentModel } from './types';

/**
 * Находит реплику, которая звучит в заданный момент записи.
 *
 * Реплики идут по порядку начала; звучащая — последняя из тех, что уже начались.
 *
 * @param segments Реплики расшифровки по порядку.
 * @param position Позиция в записи, в секундах.
 * @returns Номер реплики (`seq`) или `-1`, если запись ещё не дошла до первой.
 */
export function activeSeq(
  segments: readonly Pick<SegmentModel, 'seq' | 'start_ms'>[],
  position: number,
): number {
  const ms = position * 1000;
  let found = -1;
  for (const segment of segments) {
    if (segment.start_ms <= ms) found = segment.seq;
    else break;
  }
  return found;
}
