'use client';

import Link from 'next/link';
import { JOB_LANE_LABEL, JOB_STATUS_LABEL, JOB_STATUS_TONE } from '@/entities/job';
import { formatAge } from '@/shared/lib/format';
import { AsyncTable, adminStyles, Banner, errorText, Pill, Screen } from '@/widgets/admin-shell';
import { useAdminPipeline, useBackfill } from '../api/pipeline';
import styles from './PipelinePage.module.css';

/** Возраст, после которого очередь считается застрявшей, а не занятой. */
const STUCK_AGE_S = 3 * 60 * 60;

/**
 * Экран «Пайплайн»: очередь по полосам, зависимости, сбои и разбор истории.
 *
 * @returns Показатели, таблицы очереди и зависимостей, кнопки разбора истории.
 */
export function PipelinePage() {
  const pipeline = useAdminPipeline();
  const backfill = useBackfill();

  const data = pipeline.data;
  const errors = Object.entries(data?.errors_by_class ?? {}) as [string, number][];

  return (
    <Screen
      title="Пайплайн"
      hint="Снимок обновляется каждые пятнадцать секунд: этот экран смотрят во время происшествия, и статичное число на нём означало бы, что страницу надо обновлять руками."
    >
      {backfill.error ? <Banner kind="error">{errorText(backfill.error)}</Banner> : null}

      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardValue}>{data?.failed_last_24h ?? '—'}</span>
          <span className={styles.cardLabel}>сбоев за сутки</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardValue}>{data?.dead_total ?? '—'}</span>
          <span className={styles.cardLabel}>заданий исчерпали попытки</span>
        </div>
      </div>

      <h3 className={adminStyles.sectionTitle}>Очередь по полосам</h3>
      <p className={adminStyles.hint}>
        Строка — это полоса **и** состояние: одна полоса даёт столько строк, сколько состояний в ней
        сейчас есть. Возраст самого старого задания важнее их числа: сто заданий, взятых минуту
        назад, — это работа, а одно, лежащее третий час, — остановка.
      </p>
      <AsyncTable
        isLoading={pipeline.isLoading}
        error={pipeline.error}
        isEmpty={(data?.lanes?.length ?? 0) === 0}
        emptyText="Очередь пуста."
      >
        <table className={adminStyles.table}>
          <thead>
            <tr>
              <th>Полоса</th>
              <th>Состояние</th>
              <th className={adminStyles.numeric}>Заданий</th>
              <th>Самое старое</th>
            </tr>
          </thead>
          <tbody>
            {(data?.lanes ?? []).map((row) => {
              // Ключ из полосы и состояния: сервер отдаёт по строке на пару, и
              // ключ по одной полосе склеил бы «в очереди» с «готово».
              const stuck = row.status !== 'done' && (row.oldest_seconds ?? 0) > STUCK_AGE_S;
              return (
                <tr key={`${row.lane}:${row.status}`}>
                  <td>{JOB_LANE_LABEL[row.lane] ?? row.lane}</td>
                  <td>
                    <Pill
                      value={JOB_STATUS_LABEL[row.status] ?? row.status}
                      tone={stuck ? 'bad' : (JOB_STATUS_TONE[row.status] ?? 'plain')}
                    />
                  </td>
                  <td className={adminStyles.numeric}>{row.count}</td>
                  <td>{formatAge(row.oldest_seconds)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AsyncTable>

      <h3 className={adminStyles.sectionTitle}>Зависимости</h3>
      <p className={adminStyles.hint}>
        «Не настроена» и «не отвечает» — разное. Первое означает, что этап не включали; второе — что
        включали, и он сломан. Свести их в одно «недоступна» значит потерять единственный признак
        того, какой из двух разговоров предстоит.
      </p>
      <AsyncTable
        isLoading={pipeline.isLoading}
        error={pipeline.error}
        isEmpty={(data?.dependencies?.length ?? 0) === 0}
        emptyText="Зависимости не объявлены."
      >
        <table className={adminStyles.table}>
          <thead>
            <tr>
              <th>Зависимость</th>
              <th>Настроена</th>
              <th>Отвечает</th>
              <th>Подробности</th>
            </tr>
          </thead>
          <tbody>
            {(data?.dependencies ?? []).map((dependency) => (
              <tr key={dependency.name}>
                <td>{dependency.name}</td>
                <td>
                  <Pill
                    value={dependency.configured ? 'да' : 'нет'}
                    tone={dependency.configured ? 'ok' : 'plain'}
                  />
                </td>
                <td>
                  {dependency.reachable === null || dependency.reachable === undefined ? (
                    <Pill value="не проверялась" tone="plain" />
                  ) : (
                    <Pill
                      value={dependency.reachable ? 'да' : 'нет'}
                      tone={dependency.reachable ? 'ok' : 'bad'}
                    />
                  )}
                </td>
                <td className={adminStyles.mono}>{dependency.detail ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncTable>

      {errors.length > 0 ? (
        <>
          <h3 className={adminStyles.sectionTitle}>Сбои по классам</h3>
          <div className={adminStyles.tableWrap}>
            <table className={adminStyles.table}>
              <thead>
                <tr>
                  <th>Класс</th>
                  <th className={adminStyles.numeric}>Сбоев</th>
                </tr>
              </thead>
              <tbody>
                {errors.map(([name, count]) => (
                  <tr key={name}>
                    <td className={adminStyles.mono}>{name}</td>
                    <td className={adminStyles.numeric}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <h3 className={adminStyles.sectionTitle}>Разбор истории</h3>
      <p className={adminStyles.hint}>
        Полоса истории идёт отдельно от суточной, чтобы разбор архива не задерживал вчерашние
        звонки. Пауза не отменяет уже взятые задания — они доработают.
      </p>
      <div className={adminStyles.rowActions}>
        <button
          type="button"
          className={adminStyles.button}
          disabled={backfill.isPending}
          onClick={() => backfill.mutate('start')}
        >
          Запустить
        </button>
        <button
          type="button"
          className={adminStyles.ghost}
          disabled={backfill.isPending}
          onClick={() => backfill.mutate('pause')}
        >
          Приостановить
        </button>
        <Link href="/admin/jobs" className={adminStyles.link}>
          задания →
        </Link>
      </div>
      {backfill.data ? (
        <Banner kind="info">Затронуто заданий: {backfill.data.changed ?? 0}.</Banner>
      ) : null}
    </Screen>
  );
}
