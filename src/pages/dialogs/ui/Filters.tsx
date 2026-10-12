'use client';

import {
  PRODUCT_LABEL,
  PRODUCTS,
  PROJECT_FILTER_LABEL,
  SEGMENT_LABEL,
  SEGMENTS,
} from '@/entities/call';
import { ClassifierPicker, type ClassifierResponse } from '@/entities/classifier';
import type { SearchState } from '@/features/call-search';
import { defaultPeriod } from '@/shared/lib/date';
import common from './common.module.css';
import { Field, Select } from './Field';
import styles from './Filters.module.css';

/** Вариант справочника фильтра: оператор или проект. */
type Option = { id: string; label: string };

/**
 * Показывает фильтры выдачи: период, оператор, проект, сегмент, продукт и
 * классификация (SRC-02, SRC-02a).
 *
 * Поля дат не выключаются при «всё время», и это не мелочь оформления.
 * Выключенные, они отнимали единственный выход: вернуться к периоду можно было
 * только правкой адреса, потому что снять «всё время» полагалось изменением
 * даты — в поле, которое для этого выключено.
 *
 * @param props Свойства компонента.
 * @param props.state Состояние поиска: по нему выставлены значения полей.
 * @param props.operators Операторы выбранного источника.
 * @param props.projects Проекты выбранного источника.
 * @param props.nodes Узлы классификатора плоским списком.
 * @param props.onSubmit Вызывается с изменёнными полями состояния при каждой правке фильтра.
 * @returns Ряд полей фильтра.
 */
export function Filters({
  state,
  operators,
  projects,
  nodes,
  onSubmit,
}: {
  state: SearchState;
  operators: readonly Option[];
  projects: readonly Option[];
  nodes: NonNullable<ClassifierResponse['items']>;
  onSubmit: (patch: Partial<SearchState>) => void;
}) {
  return (
    <section className={styles.filters} aria-label="Фильтры">
      <Field id="date-from" label="Период с">
        <input
          id="date-from"
          type="date"
          className={common.control}
          value={state.from}
          onChange={(event) => onSubmit({ from: event.target.value, allTime: false })}
        />
      </Field>
      <Field id="date-to" label="Период по">
        <input
          id="date-to"
          type="date"
          className={common.control}
          value={state.to}
          onChange={(event) => onSubmit({ to: event.target.value, allTime: false })}
        />
      </Field>
      <button
        type="button"
        className={state.allTime ? common.ghostActive : common.ghost}
        aria-pressed={state.allTime}
        onClick={() =>
          onSubmit(
            state.allTime
              ? { allTime: false, ...defaultPeriod(new Date()) }
              : { allTime: true, from: '', to: '' },
          )
        }
      >
        {state.allTime ? 'Вернуть период' : 'Искать за всё время'}
      </button>

      <Select
        id="operator"
        label="Оператор"
        value={state.operatorId}
        options={operators}
        onChange={(operatorId) => onSubmit({ operatorId })}
      />
      <Select
        id="project"
        label={PROJECT_FILTER_LABEL[state.source]}
        value={state.projectId}
        options={projects}
        onChange={(projectId) => onSubmit({ projectId })}
      />
      <Field id="segment" label="Сегмент">
        <select
          id="segment"
          className={common.control}
          value={state.segment}
          onChange={(event) => onSubmit({ segment: event.target.value as SearchState['segment'] })}
        >
          <option value="">любой</option>
          {SEGMENTS.map((value) => (
            <option key={value} value={value}>
              {SEGMENT_LABEL[value]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="product" label="Продукт">
        <select
          id="product"
          className={common.control}
          value={state.product}
          onChange={(event) => onSubmit({ product: event.target.value as SearchState['product'] })}
        >
          <option value="">любой</option>
          {PRODUCTS.map((value) => (
            <option key={value} value={value}>
              {PRODUCT_LABEL[value]}
            </option>
          ))}
        </select>
      </Field>
      {/* Классификация ИИ по уровням дерева (SP-310): узел отбирает свою ветку. */}
      <Field id="classification" label="Классификация">
        <ClassifierPicker
          id="classification"
          label="Классификация"
          nodes={nodes}
          value={state.nodeId}
          controlClassName={common.control}
          onChange={(nodeId) => onSubmit({ nodeId })}
        />
      </Field>
    </section>
  );
}
