'use client';

import { percent } from '@/shared/lib/format';
import { kit } from '@/shared/ui/analytics-kit';
import type { QualitySummaryResponse } from '../api/types';
import { OTHER_OBJECTIONS, objectionCards } from '../model/objections';
import common from './common.module.css';
import styles from './Objections.module.css';

/**
 * Блок «Отработка возражений по типам»: шесть карточек макета заказчика.
 *
 * Монохромно, как в макете: доля отработки — не балл оператора, и шкала
 * «плохо — хорошо» здесь обещала бы оценку, которой никто не ставил. Карточка
 * возражения, которое не звучало, остаётся на месте с прочерком: сетка не
 * должна менять раскладку от того, что встретилось в периоде.
 *
 * Возражений в скрипте больше шести. Остальные — строкой под сеткой: в макете
 * их нет, но молча убрать их с экрана значило бы спрятать часть разговоров.
 *
 * @param props Свойства компонента.
 * @param props.summary Сводка оценок за период.
 * @returns Карточка с сеткой возражений и строкой про прочие.
 */
export function Objections({ summary }: { summary: QualitySummaryResponse }) {
  const cards = objectionCards(summary.objections ?? []);
  const other = cards.find((card) => card.key === OTHER_OBJECTIONS);
  return (
    <section className={kit.card} aria-label="Отработка возражений по типам">
      <h2 className={kit.cardTitle}>Отработка возражений — по типам</h2>
      <ul className={styles.objectionGrid}>
        {cards
          .filter((card) => card.key !== OTHER_OBJECTIONS)
          .map((card) => (
            <li
              key={card.key}
              className={styles.objectionCard}
              title={
                card.raised > 0 ? `Отработано ${card.handled} из ${card.raised}` : 'Не звучало'
              }
            >
              <span className={styles.objectionLabel}>{card.label}</span>
              <span className={styles.objectionValue}>
                <b>{card.share === null ? '—' : percent(card.share)}</b>
                <span>{card.share === null ? 'не звучало' : 'отработано'}</span>
              </span>
              <span className={styles.objectionBar} aria-hidden="true">
                {card.share ? <span style={{ width: `${card.share * 100}%` }} /> : null}
              </span>
            </li>
          ))}
      </ul>
      {other && other.raised > 0 ? (
        <p className={common.footnote}>
          Прочие возражения — отработано {other.handled} из {other.raised}:{' '}
          {other.parts
            .map((part) => `«${part.label}» — ${part.handled} из ${part.raised}`)
            .join(', ')}
          .
        </p>
      ) : null}
    </section>
  );
}
