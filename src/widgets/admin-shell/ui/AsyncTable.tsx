'use client';

import type { ReactNode } from 'react';
import { errorText } from '../lib/error-text';
import kit from './admin-kit.module.css';
import { Banner } from './Banner';

/**
 * Показывает таблицу или одно из её состояний: загрузку, отказ, пустоту.
 *
 * Загрузка, отказ и пустота — три разных состояния, и путать их нельзя.
 *
 * Пустая таблица во время загрузки читается как «ничего нет», и человек уходит
 * с неверным выводом. Поэтому «идёт загрузка» говорится словами.
 *
 * @param props Свойства компонента.
 * @param props.isLoading Идёт ли первая загрузка данных.
 * @param props.error Ошибка запроса; пустое значение — отказа нет.
 * @param props.isEmpty Пуст ли список.
 * @param props.emptyText Что сказать, когда список пуст.
 * @param props.children Таблица с данными.
 * @returns Таблица в обёртке с прокруткой или строка состояния.
 */
export function AsyncTable({
  isLoading,
  error,
  isEmpty,
  emptyText,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  if (error) return <Banner kind="error">{errorText(error)}</Banner>;
  if (isLoading) return <p className={kit.empty}>Загрузка…</p>;
  if (isEmpty) return <p className={kit.empty}>{emptyText}</p>;
  return <div className={kit.tableWrap}>{children}</div>;
}
