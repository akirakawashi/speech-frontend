'use client';

import { type ReactNode, Suspense } from 'react';
import { useSession } from '../model/session';

/** Отступ строки состояния там, где экран не задал ей свой класс. */
const DEFAULT_NOTICE_STYLE = { padding: 24 };

/**
 * Показывает содержимое только вошедшему пользователю.
 *
 * Пока сессия не готова, на месте содержимого стоит одна строка: загрузка,
 * переход на вход или причина отказа. Содержимое обёрнуто в `Suspense`:
 * страницы читают адрес через `useSearchParams`, а без границы сборка переводит
 * всю страницу в клиентский рендер и сообщает об этом предупреждением, которое
 * легко пропустить.
 *
 * @param props Свойства компонента.
 * @param props.children Содержимое для вошедшего пользователя.
 * @param props.noticeClassName Класс строки состояния; без него строка получает отступ по умолчанию.
 * @returns Содержимое или строка состояния сессии.
 */
export function SessionGate({
  children,
  noticeClassName,
}: {
  children: ReactNode;
  noticeClassName?: string;
}) {
  const session = useSession();
  const style = noticeClassName ? undefined : DEFAULT_NOTICE_STYLE;

  if (session.status === 'loading' || session.status === 'anonymous') {
    return (
      <p className={noticeClassName} style={style}>
        {session.status === 'loading' ? 'Загрузка…' : 'Переход на вход…'}
      </p>
    );
  }
  if (session.status === 'failed') {
    return (
      <p className={noticeClassName} style={style} role="alert">
        {session.error}
      </p>
    );
  }
  return (
    <Suspense
      fallback={
        <p className={noticeClassName} style={style}>
          Загрузка…
        </p>
      }
    >
      {children}
    </Suspense>
  );
}
