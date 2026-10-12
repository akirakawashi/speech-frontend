'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { PERM_ADMIN, SessionGate, useSession } from '@/entities/session';
import styles from './AdminShell.module.css';
import kit from './admin-kit.module.css';

/** Вкладки администрирования в порядке показа. */
const TABS = [
  { href: '/admin/pipeline', label: 'Пайплайн' },
  { href: '/admin/jobs', label: 'Задания' },
  { href: '/admin/topics', label: 'Темы' },
  { href: '/admin/projects', label: 'Проекты' },
  { href: '/admin/settings', label: 'Настройки' },
  { href: '/admin/reports', label: 'Отчёт' },
  { href: '/admin/audit', label: 'Журнал' },
  { href: '/admin/users', label: 'Пользователи' },
] as const;

/**
 * Рамка администрирования для вошедшего пользователя: проверка права и вкладки.
 *
 * Проверка права здесь одна на все экраны. Она **не заменяет** проверку на
 * сервере и не может её заменить: скрытая вкладка — это удобство, а решение
 * принимает ручка. Но и показывать экраны, каждый из которых ответит `403`,
 * нельзя: человек решит, что сломан сервис, а сломан у него доступ.
 *
 * @param props Свойства компонента.
 * @param props.children Экран открытого раздела.
 * @returns Шапка с вкладками и экран раздела либо объяснение, кому раздел доступен.
 */
function AdminFrame({ children }: { children: ReactNode }) {
  const session = useSession();
  const pathname = usePathname();

  if (!session.can(PERM_ADMIN)) {
    return (
      <div className={styles.shell}>
        <h1 className={styles.title}>Администрирование</h1>
        <p className={styles.notice} role="alert">
          Раздел доступен группе <code>speech_admin</code>. Твоей учётной записи она не назначена.
        </p>
        <p>
          <Link href="/dialogs" className={kit.link}>
            ← к диалогам
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>Администрирование</h1>
        <Link href="/dialogs" className={kit.link}>
          ← к диалогам
        </Link>
      </header>

      <nav className={styles.tabs} aria-label="Разделы администрирования">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.tab} ${pathname === tab.href ? styles.tabActive : ''}`}
            aria-current={pathname === tab.href ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}

/**
 * Общая рамка администрирования (SP-506): подключается как `layout` раздела.
 *
 * @param props Свойства компонента.
 * @param props.children Экран открытого раздела.
 * @returns Рамка раздела для вошедшего пользователя или строка состояния сессии.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <SessionGate noticeClassName={styles.notice}>
      <AdminFrame>{children}</AdminFrame>
    </SessionGate>
  );
}
