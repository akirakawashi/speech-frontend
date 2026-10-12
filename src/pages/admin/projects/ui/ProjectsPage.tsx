'use client';

import {
  PRODUCT_LABEL,
  PRODUCTS,
  type Product,
  SEGMENT_LABEL,
  SEGMENTS,
  type Segment,
} from '@/entities/call';
import { formatDateTime } from '@/shared/lib/format';
import { AsyncTable, adminStyles, Banner, errorText, Pill, Screen } from '@/widgets/admin-shell';
import {
  type ProjectPatch,
  useAdminProjects,
  useSyncDirectories,
  useUpdateProject,
} from '../api/projects';

/**
 * Экран «Проекты»: разметка проектов сегментом и продуктом, приём звонков.
 *
 * @returns Кнопка синхронизации и таблица проектов.
 */
export function ProjectsPage() {
  const projects = useAdminProjects();
  const update = useUpdateProject();
  const sync = useSyncDirectories();
  const items = projects.data?.items ?? [];

  /**
   * Ставит или снимает сегмент или продукт проекта.
   *
   * Пустое значение в списке — это «снять разметку», и сказать это надо явно.
   *
   * `null` в теле запроса на сервере означает «поле не трогать»: без отдельных
   * `clear_segment` / `clear_product` снять уже проставленную разметку было бы
   * нечем — выпадающий список умел бы только менять её на другую.
   *
   * @param id Идентификатор проекта.
   * @param field Что меняется: сегмент или продукт.
   * @param value Новое значение; пустая строка — снять разметку.
   */
  const setDimension = (id: string, field: 'segment' | 'product', value: string) => {
    // Обе стороны названы явно, включая `false`. Генератор типов делает поля с
    // умолчанием обязательными, и это здесь кстати: патч, в котором видно, что
    // именно **не** снимается, читается однозначно.
    const patch: ProjectPatch = { clear_segment: false, clear_product: false };
    if (field === 'segment') {
      if (value) patch.segment = value as Segment;
      else patch.clear_segment = true;
    } else {
      if (value) patch.product = value as Product;
      else patch.clear_product = true;
    }
    update.mutate({ id, patch });
  };

  return (
    <Screen
      title="Проекты"
      hint="Проект приходит из NCC и несёт очередь обращений. Сегмент и продукт задаются здесь: источник их не знает, а фильтры выдачи по ним работают. Синхронизация обновляет названия и типы известных очередей — новые появляются вместе с первым принятым звонком, перечислить их в NCC нечем."
    >
      <div className={adminStyles.rowActions}>
        <button
          type="button"
          className={adminStyles.button}
          disabled={sync.isPending}
          onClick={() => sync.mutate(undefined)}
        >
          {sync.isPending ? 'Синхронизируем…' : 'Синхронизировать с NCC'}
        </button>
      </div>

      {update.error ? <Banner kind="error">{errorText(update.error)}</Banner> : null}
      {sync.error ? <Banner kind="error">{errorText(sync.error)}</Banner> : null}
      {sync.data ? (
        <Banner kind="info">
          {/* Отчёт сервиса показывается как есть: он словами объясняет, почему
              «обновлено 0» это не поломка, а отсутствие списочного запроса. */}
          {sync.data.detail ?? `Изменено записей: ${sync.data.changed ?? 0}.`}
        </Banner>
      ) : null}

      <AsyncTable
        isLoading={projects.isLoading}
        error={projects.error}
        isEmpty={items.length === 0}
        emptyText="Проектов нет: справочник заполняется приёмом из NCC (SP-202)."
      >
        <table className={adminStyles.table}>
          <thead>
            <tr>
              <th>Проект</th>
              <th>Направление</th>
              <th>Сегмент</th>
              <th>Продукт</th>
              <th className={adminStyles.numeric}>Звонков</th>
              <th>Последний</th>
              <th>Приём</th>
            </tr>
          </thead>
          <tbody>
            {items.map((project) => (
              <tr key={project.id}>
                <td>
                  {project.title}
                  {/* У проекта из представления отчётной базы UUID в NCC нет —
                      его опознаёт ключ источника (SP-206). */}
                  <div className={adminStyles.mono}>{project.ncc_uuid ?? project.source_key}</div>
                </td>
                <td>{project.direction}</td>
                <td>
                  <select
                    className={adminStyles.control}
                    value={project.segment ?? ''}
                    aria-label={`Сегмент проекта ${project.title}`}
                    disabled={update.isPending}
                    onChange={(event) => setDimension(project.id, 'segment', event.target.value)}
                  >
                    <option value="">не задан</option>
                    {SEGMENTS.map((segment) => (
                      <option key={segment} value={segment}>
                        {SEGMENT_LABEL[segment]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className={adminStyles.control}
                    value={project.product ?? ''}
                    aria-label={`Продукт проекта ${project.title}`}
                    disabled={update.isPending}
                    onChange={(event) => setDimension(project.id, 'product', event.target.value)}
                  >
                    <option value="">не задан</option>
                    {PRODUCTS.map((product) => (
                      <option key={product} value={product}>
                        {PRODUCT_LABEL[product]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={adminStyles.numeric}>{project.calls ?? 0}</td>
                <td className={adminStyles.mono}>
                  {project.last_call_at ? formatDateTime(project.last_call_at) : '—'}
                </td>
                <td>
                  <div className={adminStyles.rowActions}>
                    <Pill
                      value={project.ingest_enabled ? 'включён' : 'выключен'}
                      tone={project.ingest_enabled ? 'ok' : 'plain'}
                    />
                    <button
                      type="button"
                      className={adminStyles.ghost}
                      disabled={update.isPending}
                      onClick={() =>
                        update.mutate({
                          id: project.id,
                          patch: {
                            clear_segment: false,
                            clear_product: false,
                            ingest_enabled: !project.ingest_enabled,
                          },
                        })
                      }
                    >
                      {project.ingest_enabled ? 'Выключить' : 'Включить'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncTable>
    </Screen>
  );
}
