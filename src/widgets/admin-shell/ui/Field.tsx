'use client';

import type { ReactNode } from 'react';
import styles from './Field.module.css';

/**
 * Показывает поле формы с подписью и пояснением.
 *
 * Подпись связана через `htmlFor`, а не обёрткой.
 *
 * Обёртка `<label><span>Этап</span><select>…</select></label>` собирает
 * доступное имя из всего содержимого метки, включая тексты вариантов:
 * «Этаплюбойприёмрасшифровка…». Диктор читает эту склейку вслух, а поиск по
 * точной подписи не находит ничего. У поля ввода этого не видно — у него нет
 * содержимого, — поэтому ошибка доживает до первого выпадающего списка.
 *
 * @param props Свойства компонента.
 * @param props.id Идентификатор поля ввода: по нему подпись связана с полем.
 * @param props.label Подпись поля.
 * @param props.hint Пояснение под полем.
 * @param props.width Наименьшая ширина поля в пикселях.
 * @param props.children Само поле ввода.
 * @returns Подпись, поле и пояснение одной колонкой.
 */
export function Field({
  id,
  label,
  hint,
  width,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  return (
    <div className={styles.field} style={width ? { minWidth: width } : undefined}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {hint ? <span className={styles.label}>{hint}</span> : null}
    </div>
  );
}
