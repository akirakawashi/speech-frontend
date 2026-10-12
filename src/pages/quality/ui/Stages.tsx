'use client';

import { type ScoreTone, scoreTone } from '@/entities/evaluation';
import { formatDay } from '@/shared/lib/date';
import { percent } from '@/shared/lib/format';
import { kit } from '@/shared/ui/analytics-kit';
import type { QualitySummaryResponse } from '../api/types';
import { stageCounts } from '../model/stages';
import type { QualityState } from '../model/state';
import common from './common.module.css';
import styles from './Stages.module.css';

const TONE: Record<ScoreTone, string | undefined> = {
  good: styles.good,
  fair: styles.fair,
  poor: styles.poor,
};

const FILL: Record<ScoreTone, string | undefined> = {
  good: styles.fillGood,
  fair: styles.fillFair,
  poor: styles.fillPoor,
};

/**
 * Блок макета «Корректность этапов»: по строке на этап скрипта, полоса и процент цветом шкалы
 * оценки.
 *
 * Процент — доля звонков, где этап засчитан. По правилу заказчика этап,
 * который не понадобился, засчитывается: у оператора, которому клиент не
 * возразил, нет повода отрабатывать возражение. Три числа раздельно —
 * выполнен, не выполнен, не понадобился — в подсказке строки и в
 * переключателе над списком звонков.
 *
 * Строка — заодно фильтр списка: звонки этого этапа, сначала те, где он не
 * выполнен. `who` — выбранный сотрудник: сводка уже посчитана по нему.
 *
 * @param props Свойства компонента.
 * @param props.summary Сводка оценок за период.
 * @param props.state Состояние экрана.
 * @param props.who Выбранный сотрудник: сводка уже посчитана по нему.
 * @param props.onChange Вызывается с новым состоянием экрана.
 * @returns Карточка со строками этапов; строка — фильтр списка звонков.
 */
export function Stages({
  summary,
  state,
  who,
  onChange,
}: {
  summary: QualitySummaryResponse;
  state: QualityState;
  who?: string;
  onChange: (next: QualityState) => void;
}) {
  const stages = summary.stages ?? [];
  return (
    <section className={kit.card} aria-label="Корректность этапов">
      <h2 className={kit.cardTitle}>Корректность этапов{who ? ` — ${who}` : ''}</h2>
      <p className={styles.periodNote}>
        Текущий период:{' '}
        <b>
          {formatDay(state.from)} – {formatDay(state.to)}
        </b>
      </p>
      <ol className={styles.stageRows}>
        {stages.map((stage, index) => {
          const counts = stageCounts(stage);
          const tone = scoreTone(stage.share * 100);
          return (
            <li key={stage.key}>
              <button
                type="button"
                className={styles.stageRow}
                aria-pressed={state.stage === stage.key}
                title={
                  `Выполнен ${counts.done}, не выполнен ${counts.failed}, ` +
                  `не понадобился ${counts.skipped}. Клик показывает звонки этапа`
                }
                onClick={() =>
                  onChange({
                    ...state,
                    stage: state.stage === stage.key ? '' : stage.key,
                    stageResult: 'failed',
                    skipped: false,
                    evaluationStatus: '',
                  })
                }
              >
                <span className={styles.num}>{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.stageLabel}>{stage.label}</span>
                <span className={styles.track} aria-hidden="true">
                  <span className={FILL[tone]} style={{ width: `${stage.share * 100}%` }} />
                </span>
                {stage.mandatory ? (
                  <span
                    className={styles.tag}
                    title="Обязательное условие: его пропуск считается нарушением"
                  >
                    чек-лист
                  </span>
                ) : null}
                <span className={`${styles.stagePct} ${TONE[tone]}`}>{percent(stage.share)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className={common.footnote}>
        Если возражений не было — этап считается выполненным (1 пункт).
      </p>
    </section>
  );
}
