'use client';
import type { CallResponse } from '@/entities/call';
import common from './common.module.css';

/**
 * Показывает причину обращения (S-32): зачем звонил клиент — оценка модели по обезличенной
 * расшифровке, а не запись оператора.
 *
 * Код — из справочника контакт-центра.
 *
 * @param props Свойства компонента.
 * @param props.data Карточка звонка.
 * @returns Строка с причиной и кодом справочника или `null`, если причины нет.
 */
export function CallReason({ data }: { data: CallResponse }) {
  if (!data.call_reason && !data.call_reason_code) return null;
  return (
    <p className={common.aiTopic}>
      <span className={common.aiTopicLabel}>Причина обращения:</span> {data.call_reason ?? ''}
      {data.call_reason_code ? (
        <span className={common.aiTopicNew}>
          {data.call_reason_label
            ? `${data.call_reason_code} · ${data.call_reason_label}`
            : data.call_reason_code}
        </span>
      ) : null}
    </p>
  );
}
