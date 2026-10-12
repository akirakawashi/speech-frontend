'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { SessionGate } from '@/entities/session';
import { parseSearchState, type SearchState, toSearchParams } from '@/features/call-search';
import { useUrlParams } from '@/shared/lib/navigation';
import { CallPanel } from '@/widgets/call-panel';
import { DialogsScreen } from './DialogsScreen';

/**
 * Показывает экран диалогов с открытой панелью разговора из адреса.
 *
 * Панель передаётся экрану, а не ставится рядом с ним: она часть той же сетки,
 * что и выдача. Отдельная колонка во всю высоту окна жила своей прокруткой и
 * обрезалась краем окна — со стороны это выглядело как всплывающее окно поверх
 * экрана.
 *
 * @returns Экран диалогов с панелью разговора, идентификатор которого взят из адреса.
 */
function CallContent() {
  const router = useRouter();
  const params = useUrlParams();
  const callId = useParams<{ id: string }>()?.id ?? '';

  const state = useMemo(() => parseSearchState(params, new Date()), [params]);
  const startAt = Number.parseInt(params.get('t') ?? '', 10);

  /**
   * Записывает новое состояние поиска в адрес, не закрывая панель.
   *
   * Правка фильтров при открытой панели остаётся на этом же адресе: человек
   * уточняет выдачу за ней.
   *
   * @param next Состояние поиска, которое должен показать экран.
   */
  const apply = useCallback(
    (next: SearchState) => {
      const query = toSearchParams(next).toString();
      router.replace(`/calls/${callId}${query ? `?${query}` : ''}`, { scroll: false });
    },
    [router, callId],
  );

  /** Закрывает панель: возвращает на «Диалоги» с тем же состоянием поиска. */
  const close = useCallback(() => {
    const query = toSearchParams(state).toString();
    router.push(query ? `/dialogs?${query}` : '/dialogs');
  }, [router, state]);

  return (
    <DialogsScreen
      state={state}
      onChange={apply}
      selectedCallId={callId}
      panel={
        <CallPanel
          callId={callId}
          query={state.q}
          startAt={Number.isFinite(startAt) ? startAt : 0}
          onClose={close}
        />
      }
    />
  );
}

/**
 * Страница разговора `/calls/<id>`: тот же экран диалогов с панелью разговора.
 *
 * @returns Экран с панелью для вошедшего пользователя или строка состояния сессии.
 */
export function CallPage() {
  return (
    <SessionGate>
      <CallContent />
    </SessionGate>
  );
}
