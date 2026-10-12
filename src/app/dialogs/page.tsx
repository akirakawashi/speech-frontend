'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useMemo } from 'react';
import { DialogsScreen } from '@/components/DialogsScreen';
import { parseSearchState, type SearchState, toSearchParams } from '@/lib/search-params';
import { useSession } from '@/lib/session';

function Screen() {
  const router = useRouter();
  const params = useSearchParams();

  // `now` берётся один раз на разбор адреса: пересчитывая его на каждый рендер,
  // мы бы каждую секунду получали новое умолчание периода и новый ключ запроса.
  const state = useMemo(
    () => parseSearchState(new URLSearchParams(params.toString()), new Date()),
    [params],
  );

  const apply = useCallback(
    (next: SearchState) => {
      const query = toSearchParams(next).toString();
      // `replace`, а не `push`: смена фильтра — уточнение того же экрана, и
      // «назад» после пяти правок фильтра должен вернуть на предыдущую
      // страницу, а не отматывать правки по одной.
      router.replace(query ? `/dialogs?${query}` : '/dialogs', { scroll: false });
    },
    [router],
  );

  return <DialogsScreen state={state} onChange={apply} />;
}

export default function DialogsPage() {
  const session = useSession();

  if (session.status === 'loading') return <p style={{ padding: 24 }}>Загрузка…</p>;
  if (session.status === 'anonymous') return <p style={{ padding: 24 }}>Переход на вход…</p>;
  if (session.status === 'failed') {
    return (
      <p role="alert" style={{ padding: 24 }}>
        {session.error}
      </p>
    );
  }

  // `useSearchParams` требует границы Suspense: без неё сборка переводит всю
  // страницу в клиентский рендер и сообщает об этом предупреждением, которое
  // легко пропустить.
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Загрузка…</p>}>
      <Screen />
    </Suspense>
  );
}
