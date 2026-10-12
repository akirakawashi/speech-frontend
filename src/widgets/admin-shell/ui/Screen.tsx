'use client';

import type { ReactNode } from 'react';
import kit from './admin-kit.module.css';

export type ScreenProps = {
  title: string;
  hint?: string;
  children: ReactNode;
};

/**
 * Экран раздела администрирования: заголовок, пояснение и содержимое.
 *
 * @param props Свойства компонента.
 * @param props.title Заголовок экрана.
 * @param props.hint Пояснение под заголовком.
 * @param props.children Содержимое экрана.
 * @returns Секция с подписью для экранного диктора.
 */
export function Screen({ title, hint, children }: ScreenProps) {
  return (
    <section className={kit.section} aria-label={title}>
      <h2 className={kit.sectionTitle}>{title}</h2>
      {hint ? <p className={kit.hint}>{hint}</p> : null}
      {children}
    </section>
  );
}
