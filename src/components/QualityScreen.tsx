'use client';

import { useMemo, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { useQualityCalls, useQualitySummary } from '@/api/queries';
import styles from '@/app/quality/quality.module.css';
import { currentConfig } from '@/lib/config';
import {
  callsQuery,
  movePeriod,
  operatorKey,
  operatorLabel,
  type Period,
  periodLabel,
  previousPeriod,
  type QualityState,
  scopeQuery,
  UNASSIGNED,
} from '@/lib/quality';
import { CallReview } from './quality/CallReview';
import { Calls } from './quality/Calls';
import { DayPicker } from './quality/DayPicker';
import { Employees } from './quality/Employees';
import { IntervalSummary } from './quality/IntervalSummary';
import { Overview } from './quality/Overview';
import { Search } from './quality/Search';
import { Objections, Outcomes, Stages } from './quality/Stages';
import { Weeks } from './quality/Weeks';
import { SectionTabs } from './SectionTabs';

function errorText(error: unknown): string {
  if (error instanceof ApiError && error.kind === 'forbidden') {
    return 'Нет права на оценки звонков.';
  }
  return 'Не удалось загрузить оценки.';
}

/** Всё, от чего зависит состав списка звонков, одной строкой. */
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
 * Показать список, если он ушёл из окна. Список стоит под блоками макета, и
 * клик по этапу или итогу иначе менял бы то, чего человек не видит.
 */
function reveal(element: HTMLElement | null): void {
  if (!element) return;
  const box = element.getBoundingClientRect();
  if (box.top < 0 || box.top > window.innerHeight * 0.8) {
    element.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Оценка качества по скрипту.
 *
 * Раскладка и вид — из макета заказчика: строка охвата, недели рядом с
 * этапами, возражения рядом с итогом звонка, итог словами, поиск по словам,
 * сотрудники. Ниже — наше: разряды звонков и полный список с отбором. Что
 * именно было сказано, показывает разбор звонка поверх экрана.
 *
 * Сводка считается по охвату (период, сотрудник) и от отбора списка не
 * зависит: клик по «Плохие» сужает список, а числа, по которым кликнули,
 * остаются на месте.
 */
export function QualityScreen({
  state,
  onChange,
}: {
  state: QualityState;
  onChange: (next: QualityState) => void;
}) {
  const timeZone = currentConfig().displayTimezone || 'Europe/Moscow';
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

  function change(next: QualityState) {
    onChange(next);
    if (listKey(next) !== listKey(state)) reveal(listRef.current);
  }

  /** Период, выбранный в календаре: возвращаться из недели больше некуда. */
  function setDay(edge: 'from' | 'to', day: string) {
    setOuter(null);
    change({ ...state, ...movePeriod(state, edge, day) });
  }

  function pickWeek(week: Period) {
    if (week.from === state.from && week.to === state.to) return;
    setOuter(outer ?? { from: state.from, to: state.to });
    change({ ...state, ...week });
  }

  function leaveWeek() {
    if (!outer) return;
    setOuter(null);
    change({ ...state, ...outer });
  }

  const openAt = items.findIndex((item) => item.call_id === state.call);
  const step = (offset: number) => {
    const target = items[openAt + offset];
    return openAt >= 0 && target ? () => onChange({ ...state, call: target.call_id }) : undefined;
  };

  const who = chosen ? operatorLabel(chosen) : undefined;

  return (
    <div className={styles.page}>
      <main className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.kicker}>Речевая аналитика</p>
          <h1 className={styles.title}>Оценка качества</h1>
        </header>

        <SectionTabs active="quality" />

        <div className={styles.panel}>
          <section className={styles.filters} aria-label="Охват">
            <span className={styles.filterLabel}>Период</span>
            <DayPicker edge="from" period={state} onPick={(day) => setDay('from', day)} />
            <DayPicker edge="to" period={state} onPick={(day) => setDay('to', day)} />
            <span className={styles.spacer} />
            <label className={styles.filterLabel} htmlFor="quality-operator">
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
            <p className={styles.notice}>Загружаем оценки…</p>
          ) : summary.isError ? (
            <p className={`${styles.notice} ${styles.alert}`} role="alert">
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
