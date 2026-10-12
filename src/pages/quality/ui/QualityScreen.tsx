'use client';

import { useMemo, useRef, useState } from 'react';
import { ApiError } from '@/shared/api';
import { displayTimeZone } from '@/shared/config';
import { movePeriod, type Period, periodLabel, previousPeriod } from '@/shared/lib/date';
import { kit } from '@/shared/ui/analytics-kit';
import { DayPicker } from '@/shared/ui/day-picker';
import { SectionTabs } from '@/widgets/section-tabs';
import { useQualityCalls, useQualitySummary } from '../api/quality';
import { operatorKey, operatorLabel } from '../model/operators';
import { callsQuery, scopeQuery } from '../model/queries';
import { type QualityState, UNASSIGNED } from '../model/state';
import { CallReview } from './CallReview';
import { Calls } from './Calls';
import { Employees } from './Employees';
import { IntervalSummary } from './IntervalSummary';
import { Objections } from './Objections';
import { Outcomes } from './Outcomes';
import { Overview } from './Overview';
import styles from './QualityScreen.module.css';
import { Search } from './Search';
import { Stages } from './Stages';
import { Weeks } from './Weeks';

/**
 * Объясняет отказ загрузки оценок словами.
 *
 * @param error Ошибка запроса.
 * @returns Текст для строки отказа.
 */
function errorText(error: unknown): string {
  if (error instanceof ApiError && error.kind === 'forbidden') {
    return 'Нет права на оценки звонков.';
  }
  return 'Не удалось загрузить оценки.';
}

/**
 * Склеивает в одну строку всё, от чего зависит состав списка звонков.
 *
 * @param state Состояние экрана.
 * @returns Строка из сотрудника и полей отбора.
 */
function listKey(state: QualityState): string {
  return [
    state.operator,
    state.bucket,
    state.stage,
    state.outcome,
    state.violations,
    state.skipped,
    state.evaluationStatus,
  ].join('|');
}

/**
 * Прокручивает к списку звонков, если он ушёл из окна.
 *
 * Список стоит под блоками макета, и клик по этапу или итогу иначе менял бы то, чего человек не
 * видит.
 *
 * @param element Обёртка списка; `null` — её ещё нет на странице.
 */
function reveal(element: HTMLElement | null): void {
  if (!element) return;
  const box = element.getBoundingClientRect();
  if (box.top < 0 || box.top > window.innerHeight * 0.8) {
    element.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Экран «Оценка качества»: оценки разговоров по скрипту продаж.
 *
 * Раскладка и вид — из макета заказчика: строка охвата, недели рядом с
 * этапами, возражения рядом с итогом звонка, итог словами, поиск по словам,
 * сотрудники. Ниже — наше: разряды звонков и полный список с отбором. Что
 * именно было сказано, показывает разбор звонка поверх экрана.
 *
 * Сводка считается по охвату (период, сотрудник) и от отбора списка не
 * зависит: клик по «Плохие» сужает список, а числа, по которым кликнули,
 * остаются на месте.
 *
 * @param props Свойства компонента.
 * @param props.state Состояние экрана из адреса.
 * @param props.onChange Вызывается с новым состоянием экрана; записывает его в адрес.
 * @returns Разметка экрана и, если открыт звонок, его разбор поверх.
 */
export function QualityScreen({
  state,
  onChange,
}: {
  state: QualityState;
  onChange: (next: QualityState) => void;
}) {
  const timeZone = displayTimeZone();
  const summary = useQualitySummary(scopeQuery(state, timeZone));
  // Таблица сотрудников и список в фильтре — из сводки по всем. Взятые из
  // текущей, они после выбора одного сотрудника состояли бы из него одного.
  const everyone = useQualitySummary(scopeQuery({ ...state, operator: '' }, timeZone));
  // Предыдущий период той же длины, по всем сотрудникам: с ним сравнивается
  // балл каждого — «динамика» из макета.
  const earlier = previousPeriod(state);
  const earlierLabel = periodLabel(earlier);
  const before = useQualitySummary(scopeQuery({ ...earlier, operator: '' }, timeZone));
  const calls = useQualityCalls(callsQuery(state, timeZone));
  const listRef = useRef<HTMLDivElement>(null);
  // Период, с которого зашли в неделю кликом по столбцу. Не в адресе: это
  // память одного захода, а не состояние экрана, которым делятся ссылкой.
  const [outer, setOuter] = useState<Period | null>(null);

  const items = useMemo(
    () => calls.data?.pages.flatMap((page) => page.items ?? []) ?? [],
    [calls.data],
  );
  const operators = everyone.data?.operators ?? [];
  const chosen = operators.find((operator) => operatorKey(operator) === state.operator);
  // Пока прошлый период не загружен, динамики нет вовсе: «стабильно» по
  // умолчанию было бы выдуманным ответом.
  const previous = useMemo(
    () =>
      before.data
        ? {
            label: earlierLabel,
            scores: new Map(
              (before.data.operators ?? []).map((operator) => [
                operatorKey(operator),
                operator.average_score,
              ]),
            ),
          }
        : null,
    [before.data, earlierLabel],
  );

  /**
   * Применяет новое состояние и показывает список звонков, если изменился его состав.
   *
   * @param next Новое состояние экрана.
   */
  function change(next: QualityState) {
    onChange(next);
    if (listKey(next) !== listKey(state)) reveal(listRef.current);
  }

  /**
   * Ставит границу периода, выбранную в календаре: возвращаться из недели больше некуда.
   *
   * @param edge Какая граница меняется: начало или конец.
   * @param day Новые сутки этой границы.
   */
  function setDay(edge: 'from' | 'to', day: string) {
    setOuter(null);
    change({ ...state, ...movePeriod(state, edge, day) });
  }

  /**
   * Ставит период на неделю столбца и запоминает период, с которого зашли.
   *
   * @param week Часть недели внутри выбранного периода.
   */
  function pickWeek(week: Period) {
    if (week.from === state.from && week.to === state.to) return;
    setOuter(outer ?? { from: state.from, to: state.to });
    change({ ...state, ...week });
  }

  /**
   * Возвращает период, с которого зашли в неделю.
   */
  function leaveWeek() {
    if (!outer) return;
    setOuter(null);
    change({ ...state, ...outer });
  }

  const openAt = items.findIndex((item) => item.call_id === state.call);
  /**
   * Строит переход к соседнему звонку списка.
   *
   * @param offset На сколько строк сдвинуться: `-1` — к предыдущему, `1` — к следующему.
   * @returns Функция перехода или `undefined`, если соседа нет.
   */
  const step = (offset: number) => {
    const target = items[openAt + offset];
    return openAt >= 0 && target ? () => onChange({ ...state, call: target.call_id }) : undefined;
  };

  const who = chosen ? operatorLabel(chosen) : undefined;

  return (
    <div className={kit.page}>
      <main className={kit.shell}>
        <header className={kit.header}>
          <p className={kit.kicker}>Речевая аналитика</p>
          <h1 className={kit.title}>Оценка качества</h1>
        </header>

        <SectionTabs active="quality" />

        <div className={kit.panel}>
          <section className={kit.filters} aria-label="Охват">
            <span className={kit.filterLabel}>Период</span>
            <DayPicker edge="from" period={state} onPick={(day) => setDay('from', day)} />
            <DayPicker edge="to" period={state} onPick={(day) => setDay('to', day)} />
            <span className={kit.spacer} />
            <label className={kit.filterLabel} htmlFor="quality-operator">
              Сотрудники
            </label>
            <select
              id="quality-operator"
              className={styles.select}
              value={state.operator}
              onChange={(event) => change({ ...state, operator: event.target.value })}
            >
              <option value="">Все сотрудники</option>
              {operators.map((operator) => (
                <option key={operatorKey(operator)} value={operatorKey(operator)}>
                  {operatorLabel(operator)}
                </option>
              ))}
              {/* Сотрудник из адреса, у которого в периоде нет оценённых звонков:
                  без своей строки список показал бы «Все сотрудники» при
                  включённом фильтре — и пустой экран выглядел бы поломкой. */}
              {state.operator && !chosen ? (
                <option value={state.operator}>
                  {state.operator === UNASSIGNED ? 'Без оператора' : 'Выбранный сотрудник'} — нет
                  звонков за период
                </option>
              ) : null}
            </select>
          </section>

          {summary.isPending ? (
            <p className={kit.notice}>Загружаем оценки…</p>
          ) : summary.isError ? (
            <p className={`${kit.notice} ${kit.alert}`} role="alert">
              {errorText(summary.error)}
            </p>
          ) : (
            <>
              <div className={styles.rowTop}>
                <Weeks
                  summary={summary.data}
                  state={state}
                  who={who}
                  outer={outer}
                  onPick={pickWeek}
                  onBack={leaveWeek}
                />
                <Stages summary={summary.data} state={state} who={who} onChange={change} />
              </div>
              <div className={styles.rowMid}>
                <Objections summary={summary.data} />
                <Outcomes summary={summary.data} state={state} onChange={change} />
              </div>
              <IntervalSummary summary={summary.data} who={who} />
              <Search state={state} onChange={onChange} />
              <Employees
                operators={operators}
                stages={summary.data.stages ?? []}
                previous={previous}
                calls={items}
                callsTotal={calls.data?.pages[0]?.total}
                state={state}
                onChange={change}
                onShowAll={() =>
                  listRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
                }
              />
              {/* Ниже — наше, в макете этого нет: разряды звонков и полный
                  список с отбором, из которого открывается разбор. */}
              <Overview summary={summary.data} state={state} onChange={change} />
              <div ref={listRef}>
                <Calls
                  items={items}
                  total={calls.data?.pages[0]?.total}
                  stages={summary.data.stages ?? []}
                  outcomes={summary.data.outcomes ?? []}
                  state={state}
                  onChange={change}
                  pending={calls.isPending}
                  failed={calls.isError}
                  hasMore={calls.hasNextPage}
                  loadingMore={calls.isFetchingNextPage}
                  onMore={() => void calls.fetchNextPage()}
                />
              </div>
            </>
          )}
        </div>
      </main>

      {state.call ? (
        <CallReview
          callId={state.call}
          onClose={() => onChange({ ...state, call: '' })}
          onPrev={step(-1)}
          onNext={step(1)}
        />
      ) : null}
    </div>
  );
}
