'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { type CallSource, useOperators, useProjects } from '@/entities/call';
import { useClassifier } from '@/entities/classifier';
import { PERM_ADMIN, PERM_EXPORT, useSession } from '@/entities/session';
import {
  exportQuery,
  queryMode,
  type SearchItemModel,
  type SearchMode,
  type SearchState,
  switchSource,
  useSearch,
  useStats,
} from '@/features/call-search';
import { apiUrl } from '@/shared/api';
import { SectionTabs } from '@/widgets/section-tabs';
import styles from './DialogsScreen.module.css';
import { Filters } from './Filters';
import { Kpi } from './Kpi';
import { Results } from './Results';
import { SearchForm } from './SearchForm';
import { SOURCE_PANEL_ID, SourceTabs, sourceTabId } from './SourceTabs';
import { Topics } from './Topics';

/**
 * Проверяет, что режим поиска из ответа сервера — один из известных.
 *
 * @param value Режим, как его назвал сервер.
 * @returns Тот же режим или `undefined`, если сервер назвал неизвестный.
 */
function asMode(value: string | undefined): SearchMode | undefined {
  return value === 'phrase' || value === 'any_order' || value === 'browse' ? value : undefined;
}

/**
 * Экран «Диалоги»: поиск по расшифровкам с фильтрами, темами и выдачей.
 *
 * @param props Свойства компонента.
 * @param props.state Состояние поиска из адреса.
 * @param props.onChange Вызывается с новым состоянием поиска; записывает его в адрес.
 * @param props.selectedCallId Звонок, открытый в панели рядом: его карточка помечается в выдаче.
 * @param props.panel Панель разговора. Встаёт внутрь сетки рядом со списком, а
 *   не отдельной колонкой во всю высоту окна: колонка, прибитая к краю окна,
 *   живёт своей прокруткой, не считается с шириной контента и обрезается там,
 *   где окно кончается.
 * @returns Разметка экрана.
 */
export function DialogsScreen({
  state,
  onChange,
  selectedCallId,
  panel,
}: {
  state: SearchState;
  onChange: (next: SearchState) => void;
  selectedCallId?: string;
  panel?: ReactNode;
}) {
  const session = useSession();
  // Строка ввода живёт отдельно от состояния поиска: иначе каждая буква
  // уходила бы в адрес и в запрос, а история браузера превращалась бы в
  // посимвольную летопись.
  const [draft, setDraft] = useState(state.q);
  useEffect(() => setDraft(state.q), [state.q]);

  const search = useSearch(state);
  const stats = useStats(state);
  const operators = useOperators(state.source);
  const projects = useProjects(state.source);
  const classifier = useClassifier();

  // Ссылка с `page=3` обязана открыть три страницы, а не третью. Догрузка идёт
  // по одной: сервер отдаёт страницами, и просить сразу шестьдесят строк
  // значило бы завести второй режим выдачи ради восстановления ссылки.
  const { hasNextPage, isFetchingNextPage, fetchNextPage, data } = search;
  const loadedPages = data?.pages.length ?? 0;
  useEffect(() => {
    if (loadedPages > 0 && loadedPages < state.page && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [loadedPages, state.page, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Ответ последней страницы несёт итоги (они одинаковы на всех страницах),
  // карточки — со всех загруженных.
  const pages = search.data?.pages ?? [];
  const page = pages[pages.length - 1];
  // Подпись описывает то, что **произойдёт**, поэтому пока набранное не совпало
  // с отправленным — она считается по набранному. Как только запрос отправлен и
  // ответ пришёл, показывается режим из ответа: сервер главный.
  //
  // Первая редакция всегда предпочитала ответ сервера — и подпись переставала
  // реагировать на кавычки: человек берёт фразу в кавычки, а под строкой
  // по-прежнему «слова в любом порядке».
  const submitted = draft.trim() === state.q.trim();
  const mode = (submitted ? asMode(page?.mode) : undefined) ?? queryMode(draft);
  const items: SearchItemModel[] = pages.flatMap((chunk) => chunk.items ?? []);

  const exportHref = useMemo(
    () => `${apiUrl('/api/v1/export')}?${exportQuery(state).toString()}`,
    [state],
  );

  /**
   * Отправляет поиск: набранный запрос, первая страница и правка фильтра.
   *
   * @param patch Поля состояния, которые меняет фильтр; без них уходит только запрос.
   */
  function submit(patch: Partial<SearchState> = {}) {
    onChange({ ...state, q: draft, page: 1, ...patch });
  }

  /**
   * Переключает вкладку источника.
   *
   * Набранный, но не отправленный запрос уходит вместе со сменой вкладки, как и
   * при смене периода: человек, набравший «тариф» и переключившийся на Телфин,
   * ищет «тариф» в Телфине.
   *
   * @param source Источник выбранной вкладки.
   */
  function chooseSource(source: CallSource) {
    if (source !== state.source) onChange(switchSource({ ...state, q: draft }, source));
  }

  return (
    <main className={styles.shell}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Диалоги</h1>
        {/* Ссылка на администрирование видна только тому, у кого есть право.
            Это удобство, а не защита: решение принимает ручка сервиса, и
            раздел откажет даже тому, кто наберёт адрес руками. Но и показывать
            вкладку, за которой один отказ, нельзя — человек решит, что сломан
            сервис, а сломан у него доступ. */}
        <span className={styles.titleLinks}>
          {session.can(PERM_ADMIN) ? (
            <Link href="/admin/pipeline" className={styles.adminLink}>
              Администрирование →
            </Link>
          ) : null}
        </span>
      </div>

      <SectionTabs active="dialogs" />

      <SourceTabs source={state.source} onChoose={chooseSource} />

      <div
        className={styles.tabPanel}
        role="tabpanel"
        id={SOURCE_PANEL_ID}
        aria-labelledby={sourceTabId(state.source)}
      >
        {/* KPI периода (SRC-08) */}
        <section className={styles.kpis} aria-label="Показатели периода">
          <Kpi value={stats.data?.processed} label="Обработано звонков" />
          <Kpi value={stats.data?.transcribed} label="Расшифровано" />
          <Kpi value={stats.data?.queued} label="Ещё в обработке" />
        </section>

        <SearchForm draft={draft} mode={mode} onDraft={setDraft} onSubmit={() => submit()} />

        <Filters
          state={state}
          operators={operators.data?.items ?? []}
          projects={projects.data?.items ?? []}
          nodes={classifier.data?.items ?? []}
          onSubmit={submit}
        />

        <Topics topics={stats.data?.topics ?? []} state={state} onChange={onChange} />

        <Results
          state={state}
          setDraft={setDraft}
          onChange={onChange}
          search={search}
          items={items}
          shown={items.length}
          hasMore={search.hasNextPage}
          queued={stats.data?.queued ?? 0}
          awaitingTranscript={Math.max(
            0,
            (stats.data?.processed ?? 0) - (stats.data?.transcribed ?? 0),
          )}
          exportHref={session.can(PERM_EXPORT) ? exportHref : null}
          selectedCallId={selectedCallId}
          panel={panel}
        />
      </div>
    </main>
  );
}
