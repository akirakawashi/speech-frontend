'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useMemo } from 'react';
import styles from '@/app/quality/quality.module.css';
import { QualityScreen } from '@/components/QualityScreen';
import { parseQualityState, type QualityState, toQualityParams } from '@/lib/quality';
import { PERM_QUALITY, useSession } from '@/lib/session';

function Screen() {
  const router = useRouter();
  const params = useSearchParams();

  // `now` — один раз на разбор адреса, как у диалогов: иначе умолчание периода
  // менялось бы с каждой секундой вместе с ключом запроса.
  const state = useMemo(
    () => parseQualityState(new URLSearchParams(params.toString()), new Date()),
    [params],
  );

  // Всё состояние — в адресе: ссылка на экран открывает тот же период, тот же
  // отбор и тот же звонок в разборе.
  const apply = useCallback(
    (next: QualityState) => {
      const query = toQualityParams(next).toString();
      router.replace(query ? `/quality?${query}` : '/quality', { scroll: false });
    },
    [router],
  );

  return <QualityScreen state={state} onChange={apply} />;
}

/**
 * Оценка качества по скрипту. Право проверяется и здесь, и на сервере: скрытый
 * экран — удобство, решение принимает ручка. Но и показывать экран, каждый
 * запрос которого ответит `403`, нельзя — человек решит, что сломан сервис.
 */
export default function QualityPage() {
  const session = useSession();

  if (session.status === 'loading') return <p className={styles.notice}>Загрузка…</p>;
  if (session.status === 'anonymous') return <p className={styles.notice}>Переход на вход…</p>;
  if (session.status === 'failed') {
    return (
      <p className={styles.notice} role="alert">
        {session.error}
      </p>
    );
  }
  if (!session.can(PERM_QUALITY)) {
    return (
      <div className={styles.page}>
        <main className={styles.shell}>
          <h1 className={styles.title}>Оценка качества</h1>
          <p className={styles.notice} role="alert">
            Оценки звонков доступны группам <code>speech_editor</code> и <code>speech_admin</code>.
            Твоей учётной записи ни одна из них не назначена.
          </p>
          <p>
            <Link href="/dialogs" className={styles.link}>
              ← к диалогам
            </Link>
          </p>
        </main>
      </div>
    );
  }

  return (
    <Suspense fallback={<p className={styles.notice}>Загрузка…</p>}>
      <Screen />
    </Suspense>
  );
}
