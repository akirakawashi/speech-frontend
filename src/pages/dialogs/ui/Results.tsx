'use client';

import type { ReactNode } from 'react';
import {
  ResultCard,
  type SearchItemModel,
  type SearchState,
  type useSearch,
} from '@/features/call-search';
import { ApiError } from '@/shared/api';
import { formatCount } from '@/shared/lib/format';
import common from './common.module.css';
import styles from './Results.module.css';

/** Примеры для пустого экрана (SRC-06, состояние 01). Из речи колл-центра. */
const EXAMPLES = ['не работает интернет', '"хочу расторгнуть договор"', 'перезвоните позже'];

/** Свойства выводятся из тела: дублировать их значит завести вторую правду. */
type ResultsProps = Parameters<typeof ResultsBody>[0] & { panel?: ReactNode };

/**
 * Ставит выдачу и панель разговора в одну сетку.
 *
 * Список и панель — одна сетка, и панель стоит в ней **всегда**.
 *
 * Раньше сетка была внутри ветки «найденное показано». У выдачи есть ещё пять
 * состояний, и в каждом панель исчезала вместе со списком. Ломалось это на
 * прямой ссылке `/calls/<id>` без параметров поиска: период умалчивается в
 * тридцать дней, январский разговор в них не попадает, выдача пуста — и
 * разговор, ради которого ссылку открыли, не показывается вовсе.
 *
 * @param props Свойства компонента.
 * @param props.panel Панель разговора; без неё выдача занимает всю ширину.
 * @param props.rest Свойства выдачи — те же, что у `ResultsBody`.
 * @returns Сетка с выдачей и панелью.
 */
export function Results({ panel, ...rest }: ResultsProps) {
  return (
    <div className={panel ? styles.split : undefined}>
      <div className={styles.column}>
        <ResultsBody {...rest} />
      </div>
      {panel ? <div className={styles.panelSlot}>{panel}</div> : null}
    </div>
  );
}

/**
 * Показывает выдачу в одном из шести состояний экрана (SRC-06).
 *
 * Порядок проверок — это и есть их приоритет: отказ важнее пустоты, пустой
 * запрос важнее пустой выдачи.
 *
 * @param props Свойства компонента.
 * @param props.state Состояние поиска.
 * @param props.setDraft Ставит текст в строку поиска — для примеров запроса.
 * @param props.onChange Вызывается с новым состоянием поиска.
 * @param props.search Запрос выдачи со всеми загруженными страницами.
 * @param props.items Найденные разговоры со всех загруженных страниц.
 * @param props.shown Сколько разговоров показано.
 * @param props.hasMore Есть ли ещё страницы.
 * @param props.queued Сколько разговоров ждут разбора.
 * @param props.awaitingTranscript Сколько звонков периода ещё не расшифрованы, то есть не ищутся.
 * @param props.exportHref `null` — права на выгрузку нет; кнопки тогда не будет вовсе.
 * @param props.selectedCallId Звонок, открытый в панели рядом. Его карточка помечается в выдаче.
 * @returns Отказ, скелетоны, подсказка, пустая выдача или список карточек с итогами.
 */
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
  awaitingTranscript: number;
  exportHref: string | null;
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
        <button type="button" className={common.ghost} onClick={() => search.refetch()}>
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
          className={common.ghost}
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
              className={common.ghost}
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
            className={common.ghost}
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
          <button type="button" className={common.ghost} onClick={() => search.refetch()}>
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
          <a className={common.ghost} href={exportHref} download>
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
            className={common.ghost}
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
