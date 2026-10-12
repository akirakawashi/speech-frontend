'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ApiError, apiUrl, type CallSource, type SearchItemModel } from '@/api/client';
import { useClassifier, useOperators, useProjects, useSearch, useStats } from '@/api/queries';
import styles from '@/app/dialogs.module.css';
import { ClassifierPicker } from '@/components/ClassifierPicker';
import { ResultCard } from '@/components/ResultCard';
import { SectionTabs } from '@/components/SectionTabs';
import { PATH_SEPARATOR, pathCaption } from '@/lib/classifier';
import { formatCount, PROJECT_FILTER_LABEL, SOURCE_LABEL } from '@/lib/format';
import {
  defaultPeriod,
  exportQuery,
  MODE_LABEL,
  PRODUCTS,
  queryMode,
  SEGMENTS,
  type SearchMode,
  type SearchState,
  SOURCES,
  switchSource,
  toggleNode,
} from '@/lib/search-params';
import { PERM_ADMIN, PERM_EXPORT, useSession } from '@/lib/session';

function asMode(value: string | undefined): SearchMode | undefined {
  return value === 'phrase' || value === 'any_order' || value === 'browse' ? value : undefined;
}

/** Панель вкладок источника (S-35) и её вкладки — связь для чтения с экрана. */
const SOURCE_PANEL_ID = 'source-panel';

function sourceTabId(source: CallSource): string {
  return `source-tab-${source}`;
}

/**
 * Куда ведёт клавиша с вкладки источника — по образцу вкладок WAI-ARIA:
 * стрелки — к соседней по кругу, Home и End — к крайним. Остальные клавиши не
 * наши (`null`): Tab обязан уводить из списка вкладок, а не ходить по нему.
 */
function sourceByKey(current: CallSource, key: string): CallSource | null {
  const index = SOURCES.indexOf(current);
  const count = SOURCES.length;
  switch (key) {
    case 'ArrowRight':
      return SOURCES[(index + 1) % count] ?? null;
    case 'ArrowLeft':
      return SOURCES[(index + count - 1) % count] ?? null;
    case 'Home':
      return SOURCES[0];
    case 'End':
      return SOURCES[count - 1] ?? null;
    default:
      return null;
  }
}

/** Примеры для пустого экрана (SRC-06, состояние 01). Из речи колл-центра. */
const EXAMPLES = ['не работает интернет', '"хочу расторгнуть договор"', 'перезвоните позже'];

export function DialogsScreen({
  state,
  onChange,
  selectedCallId,
  panel,
}: {
  state: SearchState;
  onChange: (next: SearchState) => void;
  /** Звонок, открытый в панели рядом. Его карточка помечается в выдаче. */
  selectedCallId?: string;
  /**
   * Панель разговора. Она встаёт **внутрь** сетки рядом со списком, а не
   * отдельной колонкой во всю высоту окна: колонка, прибитая к краю окна,
   * живёт своей прокруткой, не считается с шириной контента и обрезается там,
   * где окно кончается.
   */
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

  function submit(patch: Partial<SearchState> = {}) {
    onChange({ ...state, q: draft, page: 1, ...patch });
  }

  // Набранный, но не отправленный запрос уходит вместе со сменой вкладки, как
  // и при смене периода: человек, набравший «тариф» и переключившийся на
  // Телфин, ищет «тариф» в Телфине.
  function chooseSource(source: CallSource) {
    if (source !== state.source) onChange(switchSource({ ...state, q: draft }, source));
  }

  const shown = items.length;
  const hasMore = search.hasNextPage;

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

      {/* Вкладки источника (S-35). Стоят над KPI, а не среди фильтров: от
          источника зависит всё ниже — счётчики, темы, варианты оператора и
          очереди, выдача и выгрузка. Фильтр «любой» здесь нарочно не
          предлагается: смешанный список и был тем, на что жаловался владелец. */}
      <div className={styles.tabs} role="tablist" aria-label="Источник звонков">
        {SOURCES.map((source) => {
          const active = state.source === source;
          return (
            <button
              type="button"
              role="tab"
              key={source}
              id={sourceTabId(source)}
              aria-selected={active}
              aria-controls={SOURCE_PANEL_ID}
              // Бегущий tabindex: в порядке Tab стоит только выбранная вкладка,
              // между вкладками ходят стрелками.
              tabIndex={active ? 0 : -1}
              className={`${styles.tab} ${active ? styles.tabActive : ''}`}
              onClick={() => chooseSource(source)}
              onKeyDown={(event) => {
                const next = sourceByKey(source, event.key);
                if (next === null) return;
                event.preventDefault();
                chooseSource(next);
                document.getElementById(sourceTabId(next))?.focus();
              }}
            >
              {SOURCE_LABEL[source]}
            </button>
          );
        })}
      </div>

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

        {/* Строка поиска с подписью режима (SRC-01) */}
        <section>
          <form
            className={styles.searchRow}
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <input
              className={styles.input}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Слово или фраза в кавычках"
              aria-label="Поисковый запрос"
            />
            <button type="submit" className={styles.button}>
              Искать
            </button>
          </form>
          <p className={styles.mode}>{MODE_LABEL[mode]}</p>
        </section>

        {/* Фильтры (SRC-02, SRC-02a) */}
        <section className={styles.filters} aria-label="Фильтры">
          {/*
          Поля дат не выключаются при «всё время», и это не мелочь оформления.
          Выключенные, они отнимали единственный выход: вернуться к периоду
          можно было только правкой адреса, потому что снять «всё время»
          полагалось изменением даты — в поле, которое для этого выключено.
        */}
          <Field id="date-from" label="Период с">
            <input
              id="date-from"
              type="date"
              className={styles.control}
              value={state.from}
              onChange={(event) => submit({ from: event.target.value, allTime: false })}
            />
          </Field>
          <Field id="date-to" label="Период по">
            <input
              id="date-to"
              type="date"
              className={styles.control}
              value={state.to}
              onChange={(event) => submit({ to: event.target.value, allTime: false })}
            />
          </Field>
          <button
            type="button"
            className={state.allTime ? styles.ghostActive : styles.ghost}
            aria-pressed={state.allTime}
            onClick={() =>
              submit(
                state.allTime
                  ? { allTime: false, ...defaultPeriod(new Date()) }
                  : { allTime: true, from: '', to: '' },
              )
            }
          >
            {state.allTime ? 'Вернуть период' : 'Искать за всё время'}
          </button>

          <Select
            id="operator"
            label="Оператор"
            value={state.operatorId}
            options={operators.data?.items ?? []}
            onChange={(operatorId) => submit({ operatorId })}
          />
          <Select
            id="project"
            label={PROJECT_FILTER_LABEL[state.source]}
            value={state.projectId}
            options={projects.data?.items ?? []}
            onChange={(projectId) => submit({ projectId })}
          />
          <Field id="segment" label="Сегмент">
            <select
              id="segment"
              className={styles.control}
              value={state.segment}
              onChange={(event) =>
                submit({ segment: event.target.value as SearchState['segment'] })
              }
            >
              <option value="">любой</option>
              {SEGMENTS.map((value) => (
                <option key={value} value={value}>
                  {value === 'b2b' ? 'юрлицо' : 'физлицо'}
                </option>
              ))}
            </select>
          </Field>
          <Field id="product" label="Продукт">
            <select
              id="product"
              className={styles.control}
              value={state.product}
              onChange={(event) =>
                submit({ product: event.target.value as SearchState['product'] })
              }
            >
              <option value="">любой</option>
              {PRODUCTS.map((value) => (
                <option key={value} value={value}>
                  {value === 'wallet' ? 'Кошелёк' : value === 'mobile' ? 'Мобильная связь' : 'ШПД'}
                </option>
              ))}
            </select>
          </Field>
          {/* Классификация ИИ по уровням дерева (SP-310): узел отбирает свою ветку. */}
          <Field id="classification" label="Классификация">
            <ClassifierPicker
              id="classification"
              label="Классификация"
              nodes={classifier.data?.items ?? []}
              value={state.nodeId}
              controlClassName={styles.control}
              onChange={(nodeId) => submit({ nodeId })}
            />
          </Field>
        </section>

        {/* Основные темы за период (SRC-07): ветки уровня темы по классификации ИИ */}
        {stats.data?.topics?.length ? (
          <section className={styles.topics} aria-label="Основные темы за период">
            {stats.data.topics.slice(0, 10).map((topic) => {
              // Фильтр по ветке, а не поиск названия (SP-507): поиск слова
              // «Роуминг» находил одноимённые темы других веток и все упоминания.
              const path = topic.path ?? [];
              const active = state.nodeId === topic.node_id;
              return (
                <button
                  type="button"
                  key={topic.node_id}
                  className={`${styles.topicChip} ${active ? styles.topicChipActive : ''}`}
                  aria-pressed={active}
                  title={pathCaption(path)}
                  onClick={() => onChange(toggleNode(state, topic.node_id))}
                >
                  {/* Путь над темой — приглушённо: «Не работает» в ШПД и в
                    мобильной связи — разные темы, но читается тема. */}
                  {path.length > 1 ? (
                    <span className={styles.topicTrail}>
                      {pathCaption(path.slice(0, -1))}
                      {PATH_SEPARATOR}
                    </span>
                  ) : null}
                  {pathCaption(path.slice(-1))}
                  <span className={styles.topicCount}>{topic.calls}</span>
                </button>
              );
            })}
            {state.nodeId ? (
              <button
                type="button"
                className={styles.ghost}
                onClick={() => onChange({ ...state, nodeId: '', page: 1 })}
              >
                Снять фильтр по классификации
              </button>
            ) : null}
          </section>
        ) : null}

        <Results
          state={state}
          setDraft={setDraft}
          onChange={onChange}
          search={search}
          items={items}
          shown={shown}
          hasMore={hasMore}
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

function Kpi({ value, label }: { value: number | undefined; label: string }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiValue}>
        {value === undefined ? '—' : value.toLocaleString('ru-RU')}
      </div>
      <div className={styles.kpiLabel}>{label}</div>
    </div>
  );
}

/**
 * Подпись и поле связаны через `htmlFor`, а не вложенностью.
 *
 * Вложенность работает, пока поле действительно внутри, — но проверить это
 * может только человек, а не инструмент: содержимое приходит через `children`.
 * Явная связь ещё и делает клик по подписи предсказуемым в любом браузере.
 */
function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Select({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label}>
      <select
        id={id}
        className={styles.control}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">любой</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * Шесть состояний экрана (SRC-06). Порядок проверок — это и есть их
 * приоритет: отказ важнее пустоты, пустой запрос важнее пустой выдачи.
 */
/** Свойства выводятся из тела: дублировать их значит завести вторую правду. */
type ResultsProps = Parameters<typeof ResultsBody>[0] & { panel?: ReactNode };

/**
 * Список и панель — одна сетка, и панель стоит в ней **всегда**.
 *
 * Раньше сетка была внутри ветки «найденное показано». У выдачи есть ещё пять
 * состояний, и в каждом панель исчезала вместе со списком. Ломалось это на
 * прямой ссылке `/calls/<id>` без параметров поиска: период умалчивается в
 * тридцать дней, январский разговор в них не попадает, выдача пуста — и
 * разговор, ради которого ссылку открыли, не показывается вовсе.
 */
function Results({ panel, ...rest }: ResultsProps) {
  return (
    <div className={panel ? styles.split : undefined}>
      <div className={styles.column}>
        <ResultsBody {...rest} />
      </div>
      {panel ? <div className={styles.panelSlot}>{panel}</div> : null}
    </div>
  );
}

function ResultsBody({
  state,
  setDraft,
  onChange,
  search,
  items,
  shown,
  hasMore,
  queued,
  awaitingTranscript,
  exportHref,
  selectedCallId,
}: {
  state: SearchState;
  setDraft: (value: string) => void;
  onChange: (next: SearchState) => void;
  search: ReturnType<typeof useSearch>;
  items: SearchItemModel[];
  shown: number;
  hasMore: boolean;
  queued: number;
  /** Сколько звонков периода ещё не расшифрованы, то есть не ищутся. */
  awaitingTranscript: number;
  /** `null` — права на выгрузку нет; кнопки тогда не будет вовсе. */
  exportHref: string | null;
  /** Звонок, открытый в панели рядом. Его карточка помечается в выдаче. */
  selectedCallId?: string;
}) {
  const pages = search.data?.pages ?? [];
  const page = pages[pages.length - 1];

  // Отказ. Класс важен: «нет доступа» и «сервис не отвечает» требуют разных
  // действий от человека, и одинаковое «что-то пошло не так» их прячет.
  if (search.isError) {
    const error = search.error;
    const detail =
      error instanceof ApiError
        ? error.kind === 'forbidden'
          ? 'Недостаточно прав для поиска.'
          : error.kind === 'network' || error.kind === 'unavailable'
            ? 'Сервис поиска не отвечает. Попробуйте обновить страницу.'
            : `Запрос отклонён: ${error.detail || error.message}`
        : 'Непредвиденная ошибка.';
    return (
      <section className={`${styles.banner} ${styles.error}`} role="alert">
        {detail}
        <button type="button" className={styles.ghost} onClick={() => search.refetch()}>
          Повторить
        </button>
      </section>
    );
  }

  // 03: загрузка. Скелетоны только на первом запросе — при «Показать ещё»
  // прошлая страница остаётся на месте.
  if (search.isPending) {
    return (
      <section className={styles.list} aria-busy="true" aria-label="Загрузка результатов">
        {Array.from({ length: 4 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: одинаковые заглушки без состояния
          <div key={index} className={styles.skeleton} />
        ))}
      </section>
    );
  }

  // 01: пустой запрос и пустой период — показать, что здесь можно спросить.
  if (!state.q.trim() && (page?.total_calls ?? 0) === 0 && (page?.period_calls ?? 0) === 0) {
    return (
      <section className={styles.state} aria-label="Результаты поиска">
        <p className={styles.stateTitle}>За выбранный период разговоров нет</p>
        <p>Расширьте период или снимите фильтры.</p>
        <button
          type="button"
          className={styles.ghost}
          onClick={() => onChange({ ...state, allTime: true, from: '', to: '', page: 1 })}
        >
          Искать за всё время
        </button>
      </section>
    );
  }

  if (!state.q.trim() && items.length === 0) {
    return (
      <section className={styles.state} aria-label="Результаты поиска">
        <p className={styles.stateTitle}>Что ищем?</p>
        <p>Слово или фраза в кавычках — например:</p>
        <div className={styles.examples}>
          {EXAMPLES.map((example) => (
            <button
              type="button"
              key={example}
              className={styles.ghost}
              onClick={() => {
                setDraft(example);
                onChange({ ...state, q: example, page: 1 });
              }}
            >
              {example}
            </button>
          ))}
        </div>
      </section>
    );
  }

  // 02: ничего не найдено.
  if (items.length === 0) {
    return (
      <section className={styles.state} aria-label="Результаты поиска">
        <p className={styles.stateTitle}>Ничего не найдено</p>
        <p>
          Проверьте написание {state.allTime ? '' : 'или расширьте период'} — за период просмотрено{' '}
          {formatCount(page?.period_calls ?? 0, 'разговор', 'разговора', 'разговоров')}.
        </p>
        {state.allTime ? null : (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => onChange({ ...state, allTime: true, from: '', to: '', page: 1 })}
          >
            Искать за всё время
          </button>
        )}
      </section>
    );
  }

  return (
    <>
      {/* 04: часть данных ещё в обработке — иначе «найдено мало» читается как
          «мало и есть», хотя половина архива ещё расшифровывается.

          Два случая разведены, и путать их нельзя. Нерасшифрованный разговор
          не ищется вовсе — выдача от него пополнится. Расшифрованный, но не
          разобранный ищется уже сейчас; появятся у него только классификация
          и тональность, и обещать «выдача пополнится» про такой звонок — врать.
          Первая редакция обещала это про оба случая, потому что сервер отдаёт
          их одним числом. */}
      {awaitingTranscript > 0 ? (
        <section className={styles.banner}>
          {formatCount(awaitingTranscript, 'разговор', 'разговора', 'разговоров')} ещё
          расшифровываются — выдача может пополниться.
          <button type="button" className={styles.ghost} onClick={() => search.refetch()}>
            Обновить
          </button>
        </section>
      ) : queued > 0 ? (
        <section className={styles.banner}>
          {formatCount(queued, 'разговор', 'разговора', 'разговоров')} ждут разбора: искать по ним
          можно уже сейчас, классификация и тональность появятся позже.
        </section>
      ) : null}

      {/* SRC-03 */}
      <section className={styles.summary}>
        <span>
          Найдено{' '}
          <span className={styles.strong}>
            {formatCount(page?.total_matches ?? 0, 'совпадение', 'совпадения', 'совпадений')}
          </span>{' '}
          в{' '}
          <span className={styles.strong}>
            {formatCount(page?.total_calls ?? 0, 'разговоре', 'разговорах', 'разговорах')}
          </span>
        </span>
        <span>
          это {((page?.share ?? 0) * 100).toFixed(1)}% звонков за период (
          {(page?.period_calls ?? 0).toLocaleString('ru-RU')})
        </span>
        <span className={styles.spacer} />
        {/* Выгружается найденное, поэтому кнопка стоит у итогов, а не у поля
            ввода: там она предлагала выгрузить то, чего ещё нет. */}
        {exportHref ? (
          <a className={styles.ghost} href={exportHref} download>
            Экспорт списка
          </a>
        ) : null}
      </section>

      <section className={styles.list}>
        {items.map((item) => (
          <ResultCard
            key={item.call_id}
            item={item}
            state={state}
            selected={item.call_id === selectedCallId}
          />
        ))}
      </section>

      <div className={styles.summary}>
        <span>
          Показано {shown} из {page?.total_calls ?? 0}
        </span>
        {hasMore ? (
          <button
            type="button"
            className={styles.ghost}
            disabled={search.isFetchingNextPage}
            onClick={() => {
              // Номер страницы уезжает в адрес, чтобы ссылка вернула столько
              // же карточек, сколько видит отправитель.
              onChange({ ...state, page: state.page + 1 });
              void search.fetchNextPage();
            }}
          >
            {search.isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'}
          </button>
        ) : null}
      </div>
    </>
  );
}
