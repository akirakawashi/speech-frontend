'use client';

import styles from './Kpi.module.css';

/**
 * Показывает один показатель периода.
 *
 * @param props Свойства компонента.
 * @param props.value Значение показателя; `undefined` — ещё не загружено, на его месте прочерк.
 * @param props.label Подпись показателя.
 * @returns Число с подписью.
 */
export function Kpi({ value, label }: { value: number | undefined; label: string }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiValue}>
        {value === undefined ? '—' : value.toLocaleString('ru-RU')}
      </div>
      <div className={styles.kpiLabel}>{label}</div>
    </div>
  );
}
