'use client';

import type { DashboardResponse } from '../api/types';
import { themeColor } from '../model/chart';
import { count, themeSlots } from '../model/dashboard';
import common from './common.module.css';
import styles from './ThemeButtons.module.css';

/**
 * Показывает выбор темы: «Все темы» и темы графика, от частой к редкой.
 *
 * Выбор пересчитывает итог, долю негатива, подтемы и детализацию; столбцы остаются на месте — по
 * ним видно, какую часть целого составляет выбранное.
 *
 * Квадрат у названия — цвет темы на графике: по нему кнопка и сегмент
 * узнаются как одно и то же, а текст остаётся цвета текста.
 *
 * @param props Свойства компонента.
 * @param props.data Ответ дашборда.
 * @param props.selected Ключ выбранной темы; пустая строка — все темы.
 * @param props.onSelect Вызывается с ключом темы; пустая строка — выбор снят.
 * @returns Группа кнопок-тем.
 */
export function ThemeButtons({
  data,
  selected,
  onSelect,
}: {
  data: DashboardResponse;
  selected: string;
  onSelect: (theme: string) => void;
}) {
  const themes = data.themes ?? [];
  const slots = themeSlots(themes);
  return (
    <fieldset className={styles.themes}>
      <legend className={common.srOnly}>Тема</legend>
      <button
        type="button"
        className={styles.theme}
        aria-pressed={selected === ''}
        onClick={() => onSelect('')}
      >
        <span className={styles.themeName}>Все темы</span>
      </button>
      {themes.map((theme) => (
        <button
          type="button"
          key={theme.key}
          className={styles.theme}
          aria-pressed={selected === theme.key}
          title={`${theme.label}: ${count(theme.calls)}`}
          onClick={() => onSelect(selected === theme.key ? '' : theme.key)}
        >
          <span
            className={common.swatch}
            style={{ background: themeColor(theme.key, slots) }}
            aria-hidden="true"
          />
          <span className={styles.themeName}>{theme.label}</span>
        </button>
      ))}
    </fieldset>
  );
}
