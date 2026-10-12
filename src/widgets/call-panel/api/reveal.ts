import { request, type Schemas } from '@/shared/api';

/** Исходный текст реплик звонка — ответ ручки раскрытия скрытого. */
export type RevealResponse = Schemas['RevealResponse'];

/**
 * Запрашивает исходный текст реплик звонка.
 *
 * Раскрытие — разовое действие с записью в журнал: каждое обращение сервер
 * отмечает событием `pii.reveal`.
 *
 * @param callId Идентификатор звонка.
 * @returns Исходный текст по номерам реплик: номер (`seq`) → текст без маски.
 * @throws {ApiError} Сервер отказал: нет права на раскрытие или звонок не найден.
 */
export async function revealCall(callId: string): Promise<Record<number, string>> {
  const body = await request<RevealResponse>(`/api/v1/calls/${callId}/reveal`, { method: 'POST' });
  const bySeq: Record<number, string> = {};
  for (const segment of body.segments ?? []) bySeq[segment.seq] = segment.text_raw;
  return bySeq;
}
