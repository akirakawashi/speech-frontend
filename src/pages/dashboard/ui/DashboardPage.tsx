'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { SessionGate } from '@/entities/session';
import { useUrlParams } from '@/shared/lib/navigation';
import { kit } from '@/shared/ui/analytics-kit';
import {
  type DashboardState,
  isDialogsLink,
  parseDashboardState,
  toDashboardParams,
} from '../model/dashboard';
import { DashboardScreen } from './DashboardScreen';

/**
 * Читает состояние дашборда из адреса и отдаёт его экрану.
 *
 * Всё состояние — в адресе: ссылка открывает тот же период, корзину и тему.
 * Корень сайта раньше был «Диалогами», поэтому ссылка с параметрами поиска — в
 * закладках, в письмах — уводит на поиск, а не открывает дашборд.
 *
 * @returns Экран дашборда или строка о переходе к диалогам по старой ссылке.
 */
function DashboardContent() {
  const router = useRouter();
  const params = useUrlParams();
  const query = params.toString();
  const legacy = isDialogsLink(params);

  useEffect(() => {
    if (legacy) router.replace(`/dialogs?${query}`);
  }, [legacy, query, router]);

  // `now` — один раз на разбор адреса: иначе умолчание периода менялось бы с
  // каждой секундой вместе с ключом запроса.
  const state = useMemo(() => parseDashboardState(params, new Date()), [params]);

  /**
   * Записывает новое состояние экрана в адрес.
   *
   * @param next Состояние, которое должен показать экран.
   */
  const apply = useCallback(
    (next: DashboardState) => {
      const search = toDashboardParams(next).toString();
      router.replace(search ? `/?${search}` : '/', { scroll: false });
    },
    [router],
  );

  if (legacy) return <p className={kit.notice}>Открываем диалоги…</p>;
  return <DashboardScreen state={state} onChange={apply} />;
}

/**
 * Страница «Дашборд» — стартовая (решение владельца 2026-10-08).
 *
 * Отдельного права у неё нет: это счёты тех же звонков, что находит поиск.
 *
 * @returns Дашборд для вошедшего пользователя или строка состояния сессии.
 */
export function DashboardPage() {
  return (
    <SessionGate noticeClassName={kit.notice}>
      <DashboardContent />
    </SessionGate>
  );
}
