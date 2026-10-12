'use client';

import { useMemo, useState } from 'react';
import { type CallSource, SOURCE_LABEL, SOURCES, useOperators } from '@/entities/call';
import { ClassifierPicker } from '@/entities/classifier';
import { adminStyles, Banner, errorText, Field, Screen } from '@/widgets/admin-shell';
import { useReportClassification } from '../api/classification';
import {
  defaultReportFilters,
  downloadReport,
  type ReportFilters,
  reportPeriodError,
} from '../model/report';

/**
 * Экран «Отчёт»: выгрузка звонков периода в Excel (SP-604, пять уровней с SP-310).
 *
 * Файл забирается запросом, а не ссылкой: отказ сервера — «отчёт уже
 * собирается», «слишком много звонков» — надо показать словами, а ссылка
 * `<a download>` сохранила бы тело ошибки файлом. Пока файл собирается, кнопка
 * выключена: второй щелчок получил бы `429 report_busy`.
 *
 * @returns Фильтры отчёта и кнопка скачивания.
 */
export function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>(() => defaultReportFilters(new Date()));
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const operators = useOperators(filters.source);
  const periodError = reportPeriodError(filters);
  const classification = useReportClassification(
    filters.from,
    filters.to,
    filters.source,
    periodError === null,
  );

  // Варианты — только встречающиеся в периоде, и у каждой стороны свои: узел,
  // который ставил только оператор, отбором по ИИ дал бы пустой отчёт.
  const operatorNodes = useMemo(
    () => (classification.data?.items ?? []).filter((node) => (node.operator_calls ?? 0) > 0),
    [classification.data],
  );
  const aiNodes = useMemo(
    () => (classification.data?.items ?? []).filter((node) => (node.ai_calls ?? 0) > 0),
    [classification.data],
  );

  /**
   * Меняет фильтры отчёта.
   *
   * @param patch Изменённые поля фильтра.
   */
  const set = (patch: Partial<ReportFilters>) =>
    setFilters((previous) => ({ ...previous, ...patch }));
  /**
   * Смена периода сбрасывает узлы: варианты зависят от периода, и выбранный узел
   * мог в новом периоде не встречаться.
   *
   * @param patch Новая граница периода.
   */
  const setPeriod = (patch: Pick<Partial<ReportFilters>, 'from' | 'to'>) =>
    set({ ...patch, operatorNodeId: '', aiNodeId: '' });
  /**
   * Смена источника (S-35) сбрасывает и оператора: у NCC и Телфина разные
   * операторы, и выбранный в одном дал бы в другом пустой отчёт.
   *
   * @param source Выбранный источник звонков.
   */
  const setSource = (source: CallSource) =>
    set({ source, operatorId: '', operatorNodeId: '', aiNodeId: '' });

  /**
   * Скачивает отчёт; отказ показывает баннером.
   */
  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadReport(filters);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : String(error));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Screen
      title="Отчёт"
      hint="Звонки одного источника — входящие NCC или исходящие Телфина: в один файл они не смешиваются, у отчёта Телфина своё имя файла и строка «Источник» на листе. Звонки периода со всеми полями карточки и обезличенной расшифровкой: классификация оператора и классификация ИИ по пяти уровням, совпадение уровней, причина обращения (оценка ИИ по расшифровке, код справочника контакт-центра) и сводки по операторам, проблемам, причинам обращения, классификации ИИ и темам ИИ помощника. В расшифровке скрыты телефоны, счета, карты и документы; имена, организации и места — нет. Совпадение — совпавших уровней из пяти; пустой уровень оператора или прочерк не совпадает. Узел классификации отбирает всю свою ветку. В отчёт помещается до 50 000 звонков (около месяца), собирается один отчёт за раз; файл за неделю — около 15 МБ; каждая выгрузка записывается в журнал."
    >
      <div className={adminStyles.filters}>
        <Field id="report-source" label="Источник" width={190}>
          <select
            id="report-source"
            className={adminStyles.control}
            value={filters.source}
            onChange={(event) => setSource(event.target.value as CallSource)}
          >
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {SOURCE_LABEL[source]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="report-from" label="Период с" width={170}>
          <input
            id="report-from"
            type="date"
            className={adminStyles.control}
            value={filters.from}
            onChange={(event) => setPeriod({ from: event.target.value })}
          />
        </Field>
        <Field id="report-to" label="Период по" width={170}>
          <input
            id="report-to"
            type="date"
            className={adminStyles.control}
            value={filters.to}
            onChange={(event) => setPeriod({ to: event.target.value })}
          />
        </Field>
        <Field id="report-operator" label="Оператор" width={220}>
          <select
            id="report-operator"
            className={adminStyles.control}
            value={filters.operatorId}
            onChange={(event) => set({ operatorId: event.target.value })}
          >
            <option value="">любой</option>
            {(operators.data?.items ?? []).map((operator) => (
              <option key={operator.id} value={operator.id}>
                {operator.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="report-operator-node" label="Классификация оператора">
          <ClassifierPicker
            id="report-operator-node"
            label="Классификация оператора"
            nodes={operatorNodes}
            value={filters.operatorNodeId}
            controlClassName={adminStyles.control}
            count={(node) => node.operator_calls ?? 0}
            onChange={(operatorNodeId) => set({ operatorNodeId })}
          />
        </Field>
        <Field id="report-ai-node" label="Классификация ИИ">
          <ClassifierPicker
            id="report-ai-node"
            label="Классификация ИИ"
            nodes={aiNodes}
            value={filters.aiNodeId}
            controlClassName={adminStyles.control}
            count={(node) => node.ai_calls ?? 0}
            onChange={(aiNodeId) => set({ aiNodeId })}
          />
        </Field>
      </div>

      {periodError ? <Banner kind="error">{periodError}</Banner> : null}
      {classification.error ? (
        <Banner kind="error">{errorText(classification.error)}</Banner>
      ) : null}
      {downloadError ? <Banner kind="error">{downloadError}</Banner> : null}

      <div className={adminStyles.rowActions}>
        {periodError ? null : (
          <button
            type="button"
            className={adminStyles.button}
            disabled={downloading}
            onClick={() => void download()}
          >
            {downloading ? 'Отчёт собирается…' : 'Скачать Excel'}
          </button>
        )}
      </div>
    </Screen>
  );
}
