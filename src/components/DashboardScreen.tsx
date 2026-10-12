'use client';

import { ApiError } from '@/api/client';
import { useDashboard, useStats } from '@/api/queries';
import styles from '@/app/dashboard.module.css';
import quality from '@/app/quality/quality.module.css';
import { currentConfig } from '@/lib/config';
import {
  type DashboardState,
  dashboardQuery,
  GRAIN_LABEL,
  GRAINS,
  type Grain,
  statsState,
} from '@/lib/dashboard';
import { movePeriod } from '@/lib/quality';
import { ExportFile } from './dashboard/ExportFile';
import { Processed, TopicTiles } from './dashboard/Processed';
import { NegativeChart, ThemeChart } from './dashboard/ThemeChart';
import {
  Detail,
  NegativeMeter,
  PeriodSummary,
  Subtopics,
  ThemeButtons,
} from './dashboard/ThemePanel';
import { DayPicker } from './quality/DayPicker';
import { SectionTabs } from './SectionTabs';

function errorText(error: unknown): string {
  if (error instanceof ApiError && error.kind === 'forbidden') return 'Нет права на дашборд.';
  return 'Не удалось загрузить дашборд.';
}

/**
 * Дашборд: обращения в поддержку по темам за период.
 *
 * Состав — из макета заказчика: строка периода, «Обработано звонков», плитки
 * главных тем, столбцы тем и негатива слева, выбор темы с итогом справа,
 * подтемы и детализация внизу. Числа и темы — свои: макет служит ориентиром
 * (решение владельца 2026-10-08). Фон и карточки — приложения, как на
 * «Оценке качества».
 *
 * Строка периода — над всем, что от неё зависит: каждый блок ниже считается по
 * одному и тому же периоду. Выбор темы стоит над правой колонкой и подтемами —
 * он меняет только их.
 */
export function DashboardScreen({
  state,
  onChange,
}: {
  state: DashboardState;
  onChange: (next: DashboardState) => void;
}) {
  const timeZone = currentConfig().displayTimezone || 'Europe/Moscow';
  const board = useDashboard(dashboardQuery(state, timeZone));
  const stats = useStats(statsState(state));
  const data = board.data;

  /** Новая граница периода: ручная корзина и выбранная тема остаются при своём. */
  function setDay(edge: 'from' | 'to', day: string) {
    // Корзина сбрасывается: «дни» для недели и для года — разные решения.
    onChange({ ...state, ...movePeriod(state, edge, day), grain: '' });
  }

  function setGrain(grain: Grain) {
    onChange({ ...state, grain });
  }

  return (
    <div className={quality.page}>
      <main className={quality.shell}>
        <header className={quality.header}>
          <p className={quality.kicker}>Речевая аналитика</p>
          <h1 className={quality.title}>Дашборд</h1>
        </header>

        <SectionTabs active="dashboard" />

        <div className={quality.panel}>
          <section className={quality.filters} aria-label="Период">
            <span className={quality.filterLabel}>Период</span>
            <DayPicker edge="from" period={state} onPick={(day) => setDay('from', day)} />
            <DayPicker edge="to" period={state} onPick={(day) => setDay('to', day)} />
            <span className={quality.spacer} />
            {/* Нажата та корзина, что применена: без ручного выбора её назначает
                сервер по длине периода, и ответ говорит какую. */}
            <fieldset className={styles.grain}>
              <legend className={styles.srOnly}>Корзина графика</legend>
              {GRAINS.map((grain) => (
                <button
                  type="button"
                  key={grain}
                  className={styles.grainOption}
                  aria-pressed={(data?.grain ?? state.grain) === grain}
                  onClick={() => setGrain(grain)}
                >
                  {GRAIN_LABEL[grain]}
                </button>
              ))}
            </fieldset>
            <ExportFile state={state} />
          </section>

          <Processed stats={stats.data} />
          <TopicTiles stats={stats.data} state={state} />

          {board.isPending ? (
            <p className={quality.notice}>Загружаем дашборд…</p>
          ) : board.isError || !data ? (
            <p className={`${quality.notice} ${quality.alert}`} role="alert">
              {errorText(board.error)}
            </p>
          ) : (
            <div className={`${styles.board} ${board.isPlaceholderData ? styles.stale : ''}`}>
              <div className={styles.grid}>
                <div className={styles.stack}>
                  <ThemeChart data={data} />
                  <NegativeChart data={data} />
                </div>
                <div className={styles.side}>
                  <ThemeButtons
                    data={data}
                    selected={state.theme}
                    onSelect={(theme) => onChange({ ...state, theme })}
                  />
                  <PeriodSummary data={data} />
                  <NegativeMeter data={data} />
                </div>
              </div>
              <Subtopics data={data} />
              <Detail data={data} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
