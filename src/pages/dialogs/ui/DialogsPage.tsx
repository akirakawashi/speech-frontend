'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { SessionGate } from '@/entities/session';
import { parseSearchState, type SearchState, toSearchParams } from '@/features/call-search';
import { useUrlParams } from '@/shared/lib/navigation';
import { DialogsScreen } from './DialogsScreen';

/**
 * Читает состояние поиска из адреса и отдаёт его экрану диалогов.
 *
 * @returns Экран диалогов с состоянием из адреса.
 */
function DialogsContent() {
  const router = useRouter();
  const params = useUrlParams();

  // `now` берётся один раз на разбор адреса: пересчитывая его на каждый рендер,
  // мы бы каждую секунду получали новое умолчание периода и новый ключ запроса.
  const state = useMemo(() => parseSearchState(params, new Date()), [params]);

  /**
   * Записывает новое состояние поиска в адрес.
   *
   * `replace`, а не `push`: смена фильтра — уточнение того же экрана, и «назад»
   * после пяти правок фильтра должен вернуть на предыдущую страницу, а не
   * отматывать правки по одной.
   *
   * @param next Состояние поиска, которое должен показать экран.
   */
  const apply = useCallback(
    (next: SearchState) => {
      const query = toSearchParams(next).toString();
      router.replace(query ? `/dialogs?${query}` : '/dialogs', { scroll: false });
    },
    [router],
  );

  return <DialogsScreen state={state} onChange={apply} />;
}

/**
 * Страница «Диалоги»: поиск по расшифровкам разговоров.
 *
 * @returns Экран диалогов для вошедшего пользователя или строка состояния сессии.
 */
export function DialogsPage() {
  return (
    <SessionGate>
      <DialogsContent />
    </SessionGate>
  );
}
