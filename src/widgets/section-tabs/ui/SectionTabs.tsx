'use client';

import Link from 'next/link';
import { PERM_QUALITY, useSession } from '@/entities/session';
import styles from './SectionTabs.module.css';

export type Section = 'dashboard' | 'dialogs' | 'quality';

const SECTIONS: readonly { key: Section; href: string; label: string; permission?: string }[] = [
  { key: 'dashboard', href: '/', label: 'Дашборд' },
  { key: 'dialogs', href: '/dialogs', label: 'Диалоги' },
  { key: 'quality', href: '/quality', label: 'Оценка качества', permission: PERM_QUALITY },
];

/**
 * Показывает вкладки разделов приложения: «Дашборд», «Диалоги» и «Оценка качества».
 *
 * Отдельный вид от вкладок источника внутри «Диалогов»: те меняют выдачу
 * одного экрана, эти ведут на другой экран со своим адресом и своим состоянием.
 * Поэтому ссылки, а не `role="tab"`.
 *
 * Раздел оценки виден только с правом `quality`, как и сама оценка: вкладка, за
 * которой отказ, читалась бы как сломанный сервис. Дашборд и диалоги открыты
 * всем, кто вошёл.
 *
 * @param props Свойства компонента.
 * @param props.active Открытый раздел.
 * @returns Навигация со ссылками на разделы, доступные пользователю.
 */
export function SectionTabs({ active }: { active: Section }) {
  const session = useSession();
  const visible = SECTIONS.filter(
    (section) => !section.permission || session.can(section.permission),
  );
  return (
    <nav className={styles.sections} aria-label="Разделы">
      {visible.map((section) => (
        <Link
          key={section.key}
          href={section.href}
          className={styles.section}
          aria-current={section.key === active ? 'page' : undefined}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
