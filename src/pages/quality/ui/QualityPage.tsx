'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { PERM_QUALITY, SessionGate, useSession } from '@/entities/session';
import { useUrlParams } from '@/shared/lib/navigation';
import { kit } from '@/shared/ui/analytics-kit';
import { parseQualityState, type QualityState, toQualityParams } from '../model/state';
import styles from './QualityPage.module.css';
import { QualityScreen } from './QualityScreen';

/**
 * Читает состояние экрана оценки из адреса и отдаёт его экрану.
 *
 * Всё состояние — в адресе: ссылка открывает тот же период, тот же отбор и тот
 * же звонок в разборе.
 *
 * @returns Экран оценки качества с состоянием из адреса.
 */
function QualityContent() {
  const router = useRouter();
  const params = useUrlParams();

  // `now` — один раз на разбор адреса, как у диалогов: иначе умолчание периода
  // менялось бы с каждой секундой вместе с ключом запроса.
  const state = useMemo(() => parseQualityState(params, new Date()), [params]);

  /**
   * Записывает новое состояние экрана в адрес.
   *
   * @param next Состояние, которое должен показать экран.
   */
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
 * Пускает к оценкам только с правом `quality`.
 *
 * Право проверяется и здесь, и на сервере: скрытый экран — удобство, решение
 * принимает ручка. Но и показывать экран, каждый запрос которого ответит `403`,
 * нельзя — человек решит, что сломан сервис.
 *
 * @returns Экран оценки или объяснение, каким группам он доступен.
 */
function QualityAccess() {
  const session = useSession();

  if (!session.can(PERM_QUALITY)) {
    return (
      <div className={kit.page}>
        <main className={kit.shell}>
          <h1 className={kit.title}>Оценка качества</h1>
          <p className={kit.notice} role="alert">
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

  return <QualityContent />;
}

/**
 * Страница «Оценка качества»: оценки разговоров по скрипту продаж.
 *
 * @returns Экран оценки для вошедшего пользователя или строка состояния сессии.
 */
export function QualityPage() {
  return (
    <SessionGate noticeClassName={kit.notice}>
      <QualityAccess />
    </SessionGate>
  );
}
