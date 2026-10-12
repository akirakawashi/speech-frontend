'use client';

import { useStats } from '@/features/call-search';
import { ApiError } from '@/shared/api';
import { displayTimeZone } from '@/shared/config';
import { movePeriod } from '@/shared/lib/date';
import { kit } from '@/shared/ui/analytics-kit';
import { DayPicker } from '@/shared/ui/day-picker';
import { SectionTabs } from '@/widgets/section-tabs';
import { useDashboard } from '../api/dashboard';
import {
  type DashboardState,
  dashboardQuery,
  GRAIN_LABEL,
  GRAINS,
  type Grain,
  statsState,
} from '../model/dashboard';
import common from './common.module.css';
import styles from './DashboardScreen.module.css';
import { Detail } from './Detail';
import { ExportFile } from './ExportFile';
import { NegativeChart } from './NegativeChart';
import { NegativeMeter } from './NegativeMeter';
import { PeriodSummary } from './PeriodSummary';
import { Processed } from './Processed';
import { Subtopics } from './Subtopics';
import { ThemeButtons } from './ThemeButtons';
import { ThemeChart } from './ThemeChart';
import { TopicTiles } from './TopicTiles';

/**
 * Объясняет отказ загрузки дашборда словами.
 *
 * @param error Ошибка запроса.
 * @returns Текст для строки отказа.
 */
function errorText(error: unknown): string {
  if (error instanceof ApiError && error.kind === 'forbidden') return 'Нет права на дашборд.';
  return 'Не удалось загрузить дашборд.';
}

/**
 * Экран «Дашборд»: обращения в поддержку по темам за период.
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
 *
 * @param props Свойства компонента.
 * @param props.state Состояние экрана из адреса.
 * @param props.onChange Вызывается с новым состоянием экрана; записывает его в адрес.
 * @returns Разметка экрана.
 */
export function DashboardScreen({
  state,
  onChange,
}: {
  state: DashboardState;
  onChange: (next: DashboardState) => void;
}) {
  const timeZone = displayTimeZone();
  const board = useDashboard(dashboardQuery(state, timeZone));
  const stats = useStats(statsState(state));
  const data = board.data;

  /**
   * Переставляет границу периода; выбранная тема остаётся, ручная корзина сбрасывается.
   *
   * @param edge Какая граница меняется: начало или конец.
   * @param day Новые сутки этой границы.
   */
  function setDay(edge: 'from' | 'to', day: string) {
    // Корзина сбрасывается: «дни» для недели и для года — разные решения.
    onChange({ ...state, ...movePeriod(state, edge, day), grain: '' });
  }

  /**
   * Выбирает корзину графика вручную.
   *
   * @param grain Размер корзины: день, неделя или месяц.
   */
  function setGrain(grain: Grain) {
    onChange({ ...state, grain });
  }

  return (
    <div className={kit.page}>
      <main className={kit.shell}>
        <header className={kit.header}>
          <p className={kit.kicker}>Речевая аналитика</p>
          <h1 className={kit.title}>Дашборд</h1>
        </header>

        <SectionTabs active="dashboard" />

        <div className={kit.panel}>
          <section className={kit.filters} aria-label="Период">
            <span className={kit.filterLabel}>Период</span>
            <DayPicker edge="from" period={state} onPick={(day) => setDay('from', day)} />
            <DayPicker edge="to" period={state} onPick={(day) => setDay('to', day)} />
            <span className={kit.spacer} />
            {/* Нажата та корзина, что применена: без ручного выбора её назначает
                сервер по длине периода, и ответ говорит какую. */}
            <fieldset className={styles.grain}>
              <legend className={common.srOnly}>Корзина графика</legend>
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
            <p className={kit.notice}>Загружаем дашборд…</p>
          ) : board.isError || !data ? (
            <p className={`${kit.notice} ${kit.alert}`} role="alert">
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
