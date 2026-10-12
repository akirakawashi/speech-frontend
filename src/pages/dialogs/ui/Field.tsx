'use client';

import common from './common.module.css';
import styles from './Field.module.css';

/**
 * Показывает поле фильтра с подписью.
 *
 * Подпись и поле связаны через `htmlFor`, а не вложенностью.
 *
 * Вложенность работает, пока поле действительно внутри, — но проверить это
 * может только человек, а не инструмент: содержимое приходит через `children`.
 * Явная связь ещё и делает клик по подписи предсказуемым в любом браузере.
 *
 * @param props Свойства компонента.
 * @param props.id Идентификатор поля ввода: по нему подпись связана с полем.
 * @param props.label Подпись поля.
 * @param props.children Само поле ввода.
 * @returns Подпись и поле одной колонкой.
 */
export function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Показывает выпадающий список фильтра с вариантом «любой».
 *
 * @param props Свойства компонента.
 * @param props.id Идентификатор списка.
 * @param props.label Подпись поля.
 * @param props.value Выбранное значение; пустая строка — «любой».
 * @param props.options Варианты списка.
 * @param props.onChange Вызывается с выбранным значением.
 * @returns Поле с подписью и списком.
 */
export function Select({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label}>
      <select
        id={id}
        className={common.control}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">любой</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
