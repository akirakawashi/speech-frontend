'use client';

import {
  type CallResponse,
  PRODUCT_LABEL,
  SEGMENT_LABEL,
  SENTIMENT_LABEL,
  SOURCE_LABEL,
} from '@/entities/call';
import { formatDateTime, formatDuration } from '@/shared/lib/format';
import styles from './CallMeta.module.css';

/**
 * Показывает реквизиты разговора одной строкой.
 *
 * Источник стоит первым и словами (S-35). Раньше звонок Телфина отличался
 * только названием проекта, а карточка открывается и по прямой ссылке, где
 * вкладки рядом может не быть. Знак вопроса у сегмента и продукта — значение
 * определила модель, а не проект звонка.
 *
 * @param props Свойства компонента.
 * @param props.data Карточка звонка.
 * @returns Строка реквизитов: источник, время, оператор, длительность, проект, тональность, сегмент и продукт.
 */
export function CallMeta({ data }: { data: CallResponse }) {
  return (
    <div className={styles.meta}>
      <span className={styles.source}>{SOURCE_LABEL[data.source] ?? data.source}</span>
      <span>{formatDateTime(data.started_at)}</span>
      <span>{data.operator_login || 'оператор не указан'}</span>
      <span>{formatDuration(data.duration_s)}</span>
      {data.project_title ? <span>{data.project_title}</span> : null}
      {data.sentiment ? <span>{SENTIMENT_LABEL[data.sentiment] ?? data.sentiment}</span> : null}
      {data.segment ? (
        <span>
          {SEGMENT_LABEL[data.segment] ?? data.segment}
          {data.segment_source === 'llm' ? ' ?' : ''}
        </span>
      ) : null}
      {data.product ? (
        <span>
          {PRODUCT_LABEL[data.product] ?? data.product}
          {data.product_source === 'llm' ? ' ?' : ''}
        </span>
      ) : null}
    </div>
  );
}
