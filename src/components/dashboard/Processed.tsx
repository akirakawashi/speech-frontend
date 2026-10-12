'use client';

import Link from 'next/link';
import type { StatsResponse } from '@/api/client';
import styles from '@/app/dashboard.module.css';
import quality from '@/app/quality/quality.module.css';
import { PATH_SEPARATOR, pathCaption } from '@/lib/classifier';
import { count, type DashboardState, topicHref } from '@/lib/dashboard';
import { percent } from '@/lib/quality';

/**
 * «Обработано звонков»: сколько звонков периода заведено, сколько из них уже
 * расшифровано и сколько ещё в обработке. Числа — те же, что над списком
 * «Диалогов» (`/api/v1/stats`): счёт сбора, а не тем.
 */
export function Processed({ stats }: { stats: StatsResponse | undefined }) {
  const processed = stats?.processed ?? 0;
  const transcribed = stats?.transcribed ?? 0;
  const share = processed > 0 ? transcribed / processed : 0;
  return (
    <section className={styles.processed} aria-label="Обработано звонков">
      <div className={styles.processedLead}>
        <p className={styles.caption}>Обработано звонков за период</p>
        <span className={styles.figure}>{stats ? count(processed) : '—'}</span>
      </div>
      <span className={styles.rule} aria-hidden="true" />
      <div className={styles.readiness}>
        <div className={styles.readinessHead}>
          <span>
            <span className={`${styles.dot} ${styles.dotDone}`} aria-hidden="true" />
            Расшифровано <b>{stats ? count(transcribed) : '—'}</b>
          </span>
          <span>
            <span className={`${styles.dot} ${styles.dotQueued}`} aria-hidden="true" />В очереди{' '}
            <b>{stats ? count(stats.queued) : '—'}</b>
          </span>
          {processed > 0 ? (
            <span className={styles.readinessShare}>{percent(share)} готово</span>
          ) : null}
        </div>
        <div className={styles.progress} aria-hidden="true">
          <span className={styles.progressFill} style={{ width: `${share * 100}%` }} />
        </div>
      </div>
    </section>
  );
}

/**
 * Десять главных тем периода. Плитка — ссылка в «Диалоги» с отбором по ветке
 * темы: число на плитке и число найденных разговоров сходятся, потому что
 * считаются по одной ветке за один период.
 *
 * Тема здесь — узел дерева: «Не работает» у ШПД и у мобильной связи стоят
 * разными плитками, и над названием подписана ветка. На графике ниже те же
 * темы сложены по всем веткам.
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
      <p className={quality.hint}>Основные темы — клик открывает разговоры по теме</p>
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
