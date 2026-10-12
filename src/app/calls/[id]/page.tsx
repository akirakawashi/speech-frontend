'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useMemo } from 'react';
import { CallPanel } from '@/components/CallPanel';
import { DialogsScreen } from '@/components/DialogsScreen';
import { parseSearchState, type SearchState, toSearchParams } from '@/lib/search-params';
import { useSession } from '@/lib/session';

function Screen() {
  const router = useRouter();
  const params = useSearchParams();
  const route = useParams<{ id: string }>();

  const state = useMemo(
    () => parseSearchState(new URLSearchParams(params.toString()), new Date()),
    [params],
  );
  const startAt = Number.parseInt(params.get('t') ?? '', 10);

  // Правка фильтров при открытой панели остаётся на этом же адресе: панель
  // закрывать незачем, человек уточняет выдачу за ней.
  const apply = useCallback(
    (next: SearchState) => {
      const query = toSearchParams(next).toString();
      router.replace(`/calls/${route.id}${query ? `?${query}` : ''}`, { scroll: false });
    },
    [router, route.id],
  );

  const close = useCallback(() => {
    const query = toSearchParams(state).toString();
    router.push(query ? `/dialogs?${query}` : '/dialogs');
  }, [router, state]);

  // Панель передаётся экрану, а не ставится рядом с ним: она часть той же
  // сетки, что и выдача. Отдельная колонка во всю высоту окна жила своей
  // прокруткой и обрезалась краем окна — со стороны это выглядело как
  // всплывающее окно поверх экрана.
  return (
    <DialogsScreen
      state={state}
      onChange={apply}
      selectedCallId={route.id}
      panel={
        <CallPanel
          callId={route.id}
          query={state.q}
          startAt={Number.isFinite(startAt) ? startAt : 0}
          onClose={close}
        />
      }
    />
  );
}

export default function CallPage() {
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

  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Загрузка…</p>}>
      <Screen />
    </Suspense>
  );
}
