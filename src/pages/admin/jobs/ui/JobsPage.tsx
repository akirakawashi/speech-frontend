'use client';

import { useState } from 'react';
import {
  JOB_KIND_LABEL,
  JOB_KINDS,
  JOB_LANE_LABEL,
  JOB_LANES,
  JOB_STATUS_LABEL,
  JOB_STATUS_TONE,
  JOB_STATUSES,
} from '@/entities/job';
import { formatDateTime } from '@/shared/lib/format';
import {
  ADMIN_PAGE_SIZE,
  AsyncTable,
  adminStyles,
  Banner,
  errorText,
  Field,
  Pill,
  Screen,
} from '@/widgets/admin-shell';
import {
  EMPTY_JOB_FILTERS,
  type JobFilters,
  useAdminJobs,
  useReprocessCall,
  useRetryJob,
} from '../api/jobs';

/** Повтор имеет смысл только для того, что уже не движется само. */
const RETRYABLE = new Set(['failed', 'dead']);

/**
 * Экран «Задания»: очередь конвейера, повтор заданий и переобработка звонка.
 *
 * @returns Фильтры, таблица заданий и форма переобработки.
 */
export function JobsPage() {
  const [filters, setFilters] = useState<JobFilters>(EMPTY_JOB_FILTERS);
  const jobs = useAdminJobs(filters);
  const retry = useRetryJob();
  const reprocess = useReprocessCall();
  const [reprocessCall, setReprocessCall] = useState('');
  const [reprocessFrom, setReprocessFrom] = useState<string>('transcribe');

  const items = jobs.data?.items ?? [];
  const total = jobs.data?.total ?? 0;
  const shown = filters.offset + items.length;

  /**
   * Меняет фильтр заданий и возвращает на первую страницу.
   *
   * @param patch Изменённые поля фильтра.
   */
  const set = (patch: Partial<JobFilters>) =>
    setFilters((previous) => ({ ...previous, offset: 0, ...patch }));

  return (
    <Screen
      title="Задания"
      hint="Повтор доступен заданиям со сбоем и исчерпанной попыткой: остальные либо ещё идут, либо уже сделаны, и «повторить» для них означало бы сделать ту же работу дважды."
    >
      <div className={adminStyles.filters}>
        <Field id="job-status" label="Состояние">
          <select
            id="job-status"
            className={adminStyles.control}
            value={filters.status}
            onChange={(event) => set({ status: event.target.value })}
          >
            <option value="">любое</option>
            {JOB_STATUSES.map((status) => (
              <option key={status} value={status}>
                {JOB_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="job-kind" label="Этап">
          <select
            id="job-kind"
            className={adminStyles.control}
            value={filters.kind}
            onChange={(event) => set({ kind: event.target.value })}
          >
            <option value="">любой</option>
            {JOB_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {JOB_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="job-lane" label="Полоса">
          <select
            id="job-lane"
            className={adminStyles.control}
            value={filters.lane}
            onChange={(event) => set({ lane: event.target.value })}
          >
            <option value="">любая</option>
            {JOB_LANES.map((lane) => (
              <option key={lane} value={lane}>
                {JOB_LANE_LABEL[lane]}
              </option>
            ))}
          </select>
        </Field>

        <button
          type="button"
          className={adminStyles.ghost}
          onClick={() => setFilters(EMPTY_JOB_FILTERS)}
        >
          Сбросить
        </button>
      </div>

      {retry.error ? <Banner kind="error">{errorText(retry.error)}</Banner> : null}
      {retry.data ? (
        <Banner kind="info">Возвращено в очередь: {retry.data.changed ?? 0}.</Banner>
      ) : null}

      <AsyncTable
        isLoading={jobs.isLoading}
        error={jobs.error}
        isEmpty={items.length === 0}
        emptyText="Заданий с такими признаками нет."
      >
        <table className={adminStyles.table}>
          <thead>
            <tr>
              <th>Этап</th>
              <th>Состояние</th>
              <th>Полоса</th>
              <th>Звонок</th>
              <th className={adminStyles.numeric}>Попытки</th>
              <th>Создано</th>
              <th>Последний отказ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((job) => (
              <tr key={job.id}>
                <td>{JOB_KIND_LABEL[job.kind] ?? job.kind}</td>
                <td>
                  <Pill
                    value={JOB_STATUS_LABEL[job.status] ?? job.status}
                    tone={JOB_STATUS_TONE[job.status] ?? 'plain'}
                  />
                </td>
                <td>{JOB_LANE_LABEL[job.lane] ?? job.lane}</td>
                <td className={adminStyles.mono}>{job.session_id}</td>
                <td className={adminStyles.numeric}>
                  {job.attempts} / {job.max_attempts}
                </td>
                <td className={adminStyles.mono}>{formatDateTime(job.created_at)}</td>
                <td className={adminStyles.mono}>{job.last_error_class ?? '—'}</td>
                <td>
                  <button
                    type="button"
                    className={adminStyles.ghost}
                    disabled={!RETRYABLE.has(job.status) || retry.isPending}
                    onClick={() => retry.mutate(job.id)}
                  >
                    Повторить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncTable>

      {total > 0 ? (
        <div className={adminStyles.rowActions}>
          <span className={adminStyles.hint}>
            Показано {shown} из {total}
          </span>
          <button
            type="button"
            className={adminStyles.ghost}
            disabled={filters.offset === 0}
            onClick={() =>
              setFilters((p) => ({ ...p, offset: Math.max(0, p.offset - ADMIN_PAGE_SIZE) }))
            }
          >
            ← назад
          </button>
          <button
            type="button"
            className={adminStyles.ghost}
            disabled={shown >= total}
            onClick={() => setFilters((p) => ({ ...p, offset: p.offset + ADMIN_PAGE_SIZE }))}
          >
            вперёд →
          </button>
        </div>
      ) : null}

      <h3 className={adminStyles.sectionTitle}>Переобработать звонок</h3>
      <p className={adminStyles.hint}>
        Этап и всё, что за ним: переобработка с расшифровки заново разберёт разговор. Приём заново
        скачивает запись у источника — нужен, только если в хранилище её нет или она битая.
      </p>
      <form
        className={adminStyles.filters}
        onSubmit={(event) => {
          event.preventDefault();
          if (!reprocessCall.trim()) return;
          reprocess.mutate({ callId: reprocessCall.trim(), from: reprocessFrom });
        }}
      >
        <Field id="reprocess-call" label="Идентификатор звонка" width={340}>
          <input
            id="reprocess-call"
            className={adminStyles.control}
            value={reprocessCall}
            onChange={(event) => setReprocessCall(event.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
        </Field>
        <Field id="reprocess-from" label="С этапа">
          <select
            id="reprocess-from"
            className={adminStyles.control}
            value={reprocessFrom}
            onChange={(event) => setReprocessFrom(event.target.value)}
          >
            {JOB_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {JOB_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="submit"
          className={adminStyles.button}
          disabled={reprocess.isPending || !reprocessCall.trim()}
        >
          Переобработать
        </button>
      </form>
      {reprocess.error ? <Banner kind="error">{errorText(reprocess.error)}</Banner> : null}
      {reprocess.data ? (
        <Banner kind="info">
          {/* `detail` здесь — код этапа, с которого пошла переобработка, а не
              текст для человека: показывая его как есть, баннер писал слово
              «mask» и не говорил, сколько заданий поставлено. */}
          Поставлено заданий: {reprocess.data.changed ?? 0}. Этап:{' '}
          {JOB_KIND_LABEL[reprocess.data.detail ?? ''] ?? reprocess.data.detail ?? '—'}.
        </Banner>
      ) : null}
    </Screen>
  );
}
