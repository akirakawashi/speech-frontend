'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { monthGrid, monthLabel, monthOf, shiftMonth, WEEKDAYS } from '@/shared/lib/calendar';
import { formatDay, type Period } from '@/shared/lib/date';
import styles from './DayPicker.module.css';

const EDGE = {
  from: { prefix: 'с', dialog: 'Начало периода' },
  to: { prefix: 'по', dialog: 'Конец периода' },
} as const;

/**
 * Граница периода с календарём из макета заказчика: кнопка «с 24.06.2026» и месяц под ней.
 *
 * В календаре видны обе границы и сутки между ними — какую бы из двух ни
 * открыли: выбирают дату относительно второй. Выбор закрывает календарь.
 * Перевернуть период нельзя, это правило держит экран (`movePeriod`).
 *
 * @param props Свойства компонента.
 * @param props.edge Какая граница периода: начало (`from`) или конец (`to`).
 * @param props.period Период целиком: в календаре отмечены обе границы.
 * @param props.onPick Вызывается с выбранными сутками в виде `YYYY-MM-DD`.
 * @returns Кнопка границы и, пока она раскрыта, календарь месяца.
 */
export function DayPicker({
  edge,
  period,
  onPick,
}: {
  edge: 'from' | 'to';
  period: Period;
  onPick: (day: string) => void;
}) {
  const value = period[edge];
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthOf(value));
  const root = useRef<HTMLDivElement>(null);
  const dialogId = useId();

  useEffect(() => {
    if (!open) return;
    /**
     * Закрывает календарь по клику мимо него.
     *
     * @param event Событие нажатия кнопки мыши.
     */
    const onDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    /**
     * Закрывает календарь по клавише Escape.
     *
     * @param event Событие клавиатуры.
     */
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.dayPicker} ref={root}>
      <button
        type="button"
        className={styles.dayButton}
        aria-label={`Период ${EDGE[edge].prefix} ${formatDay(value)}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => {
          // Каждый раз открывается на месяце выбранной даты, а не там, куда
          // листали в прошлый раз.
          if (!open) setMonth(monthOf(value));
          setOpen(!open);
        }}
      >
        <span className={styles.dayPrefix}>{EDGE[edge].prefix}</span>
        <span className={styles.dayValue}>{formatDay(value)}</span>
      </button>
      {open ? (
        <div id={dialogId} role="dialog" aria-label={EDGE[edge].dialog} className={styles.calendar}>
          <div className={styles.calendarHead}>
            <button
              type="button"
              className={styles.calendarArrow}
              aria-label="Предыдущий месяц"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              ‹
            </button>
            <span className={styles.calendarMonth}>{monthLabel(month)}</span>
            <button
              type="button"
              className={styles.calendarArrow}
              aria-label="Следующий месяц"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              ›
            </button>
          </div>
          <div className={styles.calendarGrid} aria-hidden="true">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className={styles.calendarWeekday}>
                {weekday}
              </span>
            ))}
          </div>
          <div className={styles.calendarGrid}>
            {monthGrid(month).map((day) => {
              const isEdge = day === period.from || day === period.to;
              const inside = day > period.from && day < period.to;
              const classes = [styles.calendarDay];
              if (isEdge) classes.push(styles.calendarEdge);
              else if (inside) classes.push(styles.calendarInside);
              if (monthOf(day) !== month) classes.push(styles.calendarOutside);
              return (
                <button
                  type="button"
                  key={day}
                  className={classes.join(' ')}
                  aria-label={formatDay(day)}
                  aria-pressed={day === value}
                  onClick={() => {
                    onPick(day);
                    setOpen(false);
                  }}
                >
                  {Number(day.slice(8))}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
