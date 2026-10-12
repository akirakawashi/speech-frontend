'use client';

import type { ReactNode } from 'react';
import styles from './Banner.module.css';

/**
 * Показывает сообщение над экраном: результат действия или отказ.
 *
 * @param props Свойства компонента.
 * @param props.children Текст сообщения.
 * @param props.kind Вид сообщения: `info` — результат, `error` — отказ.
 * @returns Абзац с ролью `status` или `alert`.
 */
export function Banner({ children, kind }: { children: ReactNode; kind: 'info' | 'error' }) {
  return (
    <p
      className={`${styles.banner} ${kind === 'error' ? styles.error : ''}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  );
}
