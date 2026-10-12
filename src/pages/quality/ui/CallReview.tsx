'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './CallReview.module.css';
import { CallReviewBody } from './CallReviewBody';

/** Сколько уезжает панель при закрытии. Совпадает с `--dur-2` в стилях. */
const CLOSE_MS = 180;

/**
 * Проверяет, включено ли движение: браузер умеет о нём спросить, и человек его не отключал.
 *
 * @returns `true`, если анимацию показывать можно.
 */
function animated(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Панель разбора звонка поверх экрана: вердикты по этапам рядом с тем, что было сказано.
 *
 * Модель может ошибаться, и проверить её можно только разговором. Поэтому
 * этап ведёт к своим репликам, а метка времени включает запись с этого места.
 * Реплики, на которые ссылается невыполненный этап, отмечены в разговоре сразу —
 * плохое место видно, не выбирая этап.
 *
 * @param props Свойства компонента.
 * @param props.callId Идентификатор звонка.
 * @param props.onClose Вызывается, когда панель закрыта и уехала.
 * @param props.onPrev Открывает предыдущий звонок списка; `undefined` — его нет.
 * @param props.onNext Открывает следующий звонок списка; `undefined` — его нет.
 * @returns Затемнение и выдвижная панель с разбором.
 */
export function CallReview({
  callId,
  onClose,
  onPrev,
  onNext,
}: {
  callId: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    panelRef.current?.focus();
    // Страница под панелью не должна листаться колесом, пока листают разговор.
    // Вместе с прокруткой у неё исчезает полоса, и без поправки всё под панелью
    // прыгало бы вправо на её ширину: место полосы занимает отступ.
    const { body, documentElement } = document;
    const gap = window.innerWidth - documentElement.clientWidth;
    const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = previous.overflow;
      body.style.paddingRight = previous.paddingRight;
      clearTimeout(timer.current);
    };
  }, []);

  /**
   * Панель уезжает, и только потом исчезает: закрытие без движения после
   * въезда с движением читается как сбой.
   */
  const close = useCallback(() => {
    if (timer.current !== undefined) return;
    if (!animated()) {
      onClose();
      return;
    }
    setClosing(true);
    timer.current = setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    /**
     * Закрывает панель по клавише Escape.
     *
     * @param event Событие клавиатуры.
     */
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <>
      <button
        type="button"
        className={`${styles.backdrop} ${closing ? styles.backdropClosing : ''}`}
        aria-hidden="true"
        tabIndex={-1}
        onClick={close}
      />
      <aside
        className={`${styles.panel} ${closing ? styles.panelClosing : ''}`}
        aria-label="Разбор звонка"
        ref={panelRef}
        tabIndex={-1}
      >
        {/* Ключ по звонку: позиция записи и выбранный этап — свойства одного
            разбора. Сама панель при этом остаётся на месте — переход к
            соседнему звонку не должен заново её выдвигать. */}
        <CallReviewBody
          key={callId}
          callId={callId}
          onClose={close}
          onPrev={onPrev}
          onNext={onNext}
        />
      </aside>
    </>
  );
}
