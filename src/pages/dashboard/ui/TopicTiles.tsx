'use client';

import Link from 'next/link';
import { PATH_SEPARATOR, pathCaption } from '@/entities/classifier';
import type { StatsResponse } from '@/features/call-search';
import { kit } from '@/shared/ui/analytics-kit';
import { count, type DashboardState, topicHref } from '../model/dashboard';
import styles from './TopicTiles.module.css';

/**
 * Показывает десять главных тем периода плитками.
 *
 * Плитка — ссылка в «Диалоги» с отбором по ветке темы: число на плитке и число найденных разговоров
 * сходятся, потому что считаются по одной ветке за один период.
 *
 * Тема здесь — узел дерева: «Не работает» у ШПД и у мобильной связи стоят
 * разными плитками, и над названием подписана ветка. На графике ниже те же
 * темы сложены по всем веткам.
 *
 * @param props Свойства компонента.
 * @param props.stats Счёты периода; `undefined` — ещё не загружены.
 * @param props.state Состояние экрана: период уходит в ссылку плитки.
 * @returns Блок плиток или `null`, если тем нет.
 */
export function TopicTiles({
  stats,
  state,
}: {
  stats: StatsResponse | undefined;
  state: Pick<DashboardState, 'from' | 'to'>;
}) {
  const topics = (stats?.topics ?? []).slice(0, 10);
  if (topics.length === 0) return null;
  return (
    <section className={styles.tilesBlock} aria-label="Основные темы за период">
      <p className={kit.hint}>Основные темы — клик открывает разговоры по теме</p>
      <ul className={styles.tiles}>
        {topics.map((topic) => {
          const path = topic.path ?? [];
          return (
            <li key={topic.node_id}>
              <Link
                href={topicHref(state, topic.node_id)}
                className={styles.tile}
                title={pathCaption(path)}
              >
                <span className={styles.tileValue}>{count(topic.calls)}</span>
                {/* Путь над темой — приглушённо, как на «Диалогах»: «Расторжение
                    договора» у физлица и у юрлица — разные плитки. */}
                {path.length > 1 ? (
                  <span className={styles.tileTrail}>
                    {pathCaption(path.slice(0, -1))}
                    {PATH_SEPARATOR}
                  </span>
                ) : null}
                <span>{pathCaption(path.slice(-1))}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
