'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo } from 'react';
import quality from '@/app/quality/quality.module.css';
import { DashboardScreen } from '@/components/DashboardScreen';
import {
  type DashboardState,
  isDialogsLink,
  parseDashboardState,
  toDashboardParams,
} from '@/lib/dashboard';
import { useSession } from '@/lib/session';

function Screen() {
  const router = useRouter();
  const params = useSearchParams();
  // Корень сайта раньше был «Диалогами». Ссылка с параметрами поиска — в
  // закладках, в письмах — должна открыть поиск, а не дашборд.
  const legacy = isDialogsLink(new URLSearchParams(params.toString()));

  useEffect(() => {
    if (legacy) router.replace(`/dialogs?${params.toString()}`);
  }, [legacy, params, router]);

  // `now` — один раз на разбор адреса: иначе умолчание периода менялось бы с
  // каждой секундой вместе с ключом запроса.
  const state = useMemo(
    () => parseDashboardState(new URLSearchParams(params.toString()), new Date()),
    [params],
  );

  // Всё состояние — в адресе: ссылка открывает тот же период, корзину и тему.
  const apply = useCallback(
    (next: DashboardState) => {
      const query = toDashboardParams(next).toString();
      router.replace(query ? `/?${query}` : '/', { scroll: false });
    },
    [router],
  );

  if (legacy) return <p className={quality.notice}>Открываем диалоги…</p>;
  return <DashboardScreen state={state} onChange={apply} />;
}

/**
 * Дашборд — стартовая страница (решение владельца 2026-10-08). Отдельного права
 * у него нет: это счёты тех же звонков, что находит поиск.
 */
export default function DashboardPage() {
  const session = useSession();

  if (session.status === 'loading') return <p className={quality.notice}>Загрузка…</p>;
  if (session.status === 'anonymous') return <p className={quality.notice}>Переход на вход…</p>;
  if (session.status === 'failed') {
    return (
      <p className={quality.notice} role="alert">
        {session.error}
      </p>
    );
  }

  return (
    <Suspense fallback={<p className={quality.notice}>Загрузка…</p>}>
      <Screen />
    </Suspense>
  );
}
