'use client';

import type { DashboardResponse } from '@/api/client';
import styles from '@/app/dashboard.module.css';
import quality from '@/app/quality/quality.module.css';
import { count, signedPercent, summaryText, themeSlots } from '@/lib/dashboard';
import { percent, periodLabel } from '@/lib/quality';
import { themeColor } from './ThemeChart';

/**
 * Выбор темы: «Все темы» и темы графика, от частой к редкой. Выбор
 * пересчитывает итог, долю негатива, подтемы и детализацию; столбцы остаются
 * на месте — по ним видно, какую часть целого составляет выбранное.
 *
 * Квадрат у названия — цвет темы на графике: по нему кнопка и сегмент
 * узнаются как одно и то же, а текст остаётся цвета текста.
 */
export function ThemeButtons({
  data,
  selected,
  onSelect,
}: {
  data: DashboardResponse;
  selected: string;
  onSelect: (theme: string) => void;
}) {
  const themes = data.themes ?? [];
  const slots = themeSlots(themes);
  return (
    <fieldset className={styles.themes}>
      <legend className={styles.srOnly}>Тема</legend>
      <button
        type="button"
        className={styles.theme}
        aria-pressed={selected === ''}
        onClick={() => onSelect('')}
      >
        <span className={styles.themeName}>Все темы</span>
      </button>
      {themes.map((theme) => (
        <button
          type="button"
          key={theme.key}
          className={styles.theme}
          aria-pressed={selected === theme.key}
          title={`${theme.label}: ${count(theme.calls)}`}
          onClick={() => onSelect(selected === theme.key ? '' : theme.key)}
        >
          <span
            className={styles.swatch}
            style={{ background: themeColor(theme.key, slots) }}
            aria-hidden="true"
          />
          <span className={styles.themeName}>{theme.label}</span>
        </button>
      ))}
    </fieldset>
  );
}

/** «Итог за период» словами — по всем темам или по выбранной. */
export function PeriodSummary({ data }: { data: DashboardResponse }) {
  return (
    <section className={quality.card} aria-label="Итог за период">
      <p className={styles.eyebrow}>Итог за период</p>
      <p className={styles.summary}>{summaryText(data)}</p>
    </section>
  );
}

/**
 * Доля негатива за период — одно число, поэтому не график, а показатель с
 * кольцом-шкалой. Считается среди звонков с тональностью: неразобранные в
 * знаменатель не идут.
 */
export function NegativeMeter({ data }: { data: DashboardResponse }) {
  const share = data.selection.negative_share;
  const known = share !== null && share !== undefined;
  const scope = data.selection.theme
    ? `по теме «${data.selection.label}» за весь выбранный период`
    : 'по всем темам за весь выбранный период';
  return (
    <section className={`${quality.card} ${styles.meterCard}`} aria-label="Доля негатива">
      <div
        className={styles.meter}
        style={{
          background: `conic-gradient(var(--negative) ${(known ? share : 0) * 360}deg, var(--negative-track) 0)`,
        }}
        aria-hidden="true"
      >
        <span className={styles.meterCenter}>{known ? percent(share) : '—'}</span>
      </div>
      <div className={styles.meterText}>
        <span className={styles.meterTitle}>
          Доля негатива{known ? ` — ${percent(share)}` : ''}
        </span>
        <span className={styles.caption}>
          {known ? scope : 'у звонков периода ещё нет тональности'}
        </span>
      </div>
    </section>
  );
}

/** Подтемы выбранной темы. У «Прочего» — темы, которые в него сложены. */
export function Subtopics({ data }: { data: DashboardResponse }) {
  const subtopics = data.selection.subtopics ?? [];
  if (!data.selection.theme || subtopics.length === 0) return null;
  return (
    <section className={quality.card} aria-label="Внутренние темы">
      <div className={quality.cardHead}>
        <h2 className={quality.cardTitle}>Внутренние темы — {data.selection.label}</h2>
        <span className={quality.hint}>доля обращений темы</span>
      </div>
      <ul className={styles.subtopics}>
        {subtopics.map((subtopic) => (
          <li key={subtopic.key} className={styles.subtopic}>
            <span>{subtopic.label}</span>
            <span className={styles.subtopicBar} aria-hidden="true">
              <span className={styles.subtopicFill} style={{ width: `${subtopic.share * 100}%` }} />
            </span>
            <b>{percent(subtopic.share)}</b>
            <span className={styles.subtopicCalls}>{count(subtopic.calls)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Детализация: четыре числа выбранной темы или всех тем. «Изменение» — вторая
 * половина периода к первой; когда сравнивать не с чем, стоит прочерк, а не
 * ноль: ноль значил бы «не изменилось».
 */
export function Detail({ data }: { data: DashboardResponse }) {
  const chosen = data.selection;
  const peak = chosen.peak;
  return (
    <section className={quality.card} aria-label="Детализация">
      <h2 className={quality.cardTitle}>Детализация{chosen.theme ? ` — ${chosen.label}` : ''}</h2>
      <dl className={styles.detail}>
        <div>
          <dt>Обращений за период</dt>
          <dd>{count(chosen.calls)}</dd>
        </div>
        <div>
          <dt>Изменение к 1-й половине</dt>
          <dd>
            {chosen.change === null || chosen.change === undefined
              ? '—'
              : signedPercent(chosen.change)}
          </dd>
        </div>
        <div>
          <dt>Доля негатива</dt>
          <dd>
            {chosen.negative_share === null || chosen.negative_share === undefined
              ? '—'
              : percent(chosen.negative_share)}
          </dd>
        </div>
        <div>
          <dt>Пик за неделю</dt>
          <dd>
            {peak ? count(peak.calls) : '—'}
            {peak ? (
              <span className={styles.detailNote}>
                {periodLabel({ from: peak.start, to: peak.end })}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
    </section>
  );
}
