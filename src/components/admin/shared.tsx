'use client';

/**
 * Общие части экранов администрирования (SP-506).
 *
 * Семь экранов устроены одинаково: заголовок, пояснение, состояние загрузки,
 * таблица, отказ. Различия — в данных. Всё, что одинаково, живёт здесь, иначе
 * через месяц у семи экранов будет семь разных текстов на один и тот же отказ.
 */

import type { ReactNode } from 'react';
import { ApiError } from '@/api/client';
import styles from '@/app/admin/admin.module.css';

/**
 * Отказ показывается по классу, а не одним текстом на все случаи.
 *
 * «Что-то пошло не так» одинаково выглядит при отсутствии прав, недоступном
 * сервисе и неверном значении — и превращает разбор любой жалобы в разговор
 * вслепую. Детали от сервера при этом не выбрасываются: в них обычно и лежит
 * ответ.
 */
/**
 * Коды отказов сервиса и что они значат для человека.
 *
 * Сервер отвечает машине: его коды нужны такими в тестах и логах. Но в баннере
 * `call_has_queued_or_running_jobs` — это не сообщение, а строка, которую
 * читатель не обязан понимать. Неизвестный код показывается как есть: выдумать
 * ему текст значило бы соврать.
 */
const REFUSAL_TEXT: Record<string, string> = {
  call_has_queued_or_running_jobs:
    'У звонка есть незавершённые задания. Переобработка их бы дублировала — дождись, пока очередь дойдёт до конца, или сними задание на экране заданий.',
  job_is_not_failed_or_dead:
    'Повторить можно только задание со сбоем или с исчерпанными попытками.',
  pipeline_is_busy: 'Конвейер занят другой перестройкой. Повтори через минуту.',
  nothing_to_change: 'В запросе нет ни одного изменения.',
  not_found: 'Запись не найдена — возможно, её уже изменили.',
  ncc_not_configured:
    'Синхронизация не настроена: не заданы адрес NCC, логин или токен. Это правится в развёртывании, повторное нажатие не поможет.',
};

function refusalText(detail: string): string | null {
  const key = detail.trim();
  if (REFUSAL_TEXT[key]) return REFUSAL_TEXT[key];
  // `unknown_settings: retention_dayz` — код с уточнением после двоеточия.
  const prefix = key.split(':', 1)[0]?.trim() ?? '';
  if (prefix === 'ncc' || key.startsWith('ncc_'))
    return `NCC ответил отказом (${key.replace(/^ncc_/, '')}). Справочники не изменены.`;
  if (prefix === 'unknown_settings')
    return `Сервер не знает такой настройки (${key.slice(prefix.length + 1).trim()}).`;
  return null;
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    const known = refusalText(error.detail);
    if (known) return known;
    switch (error.kind) {
      case 'forbidden':
        return 'Недостаточно прав: действие доступно группе speech_admin.';
      case 'unauthorized':
        return 'Сессия истекла. Обнови страницу, чтобы войти заново.';
      case 'not_found':
        return 'Запись не найдена — возможно, её уже изменили.';
      case 'conflict':
        return error.detail || 'Изменение конфликтует с текущим состоянием.';
      case 'invalid':
        return error.detail || 'Значение не принято сервером.';
      case 'unavailable':
        return 'Сервис недоступен. Данные не изменены.';
      case 'network':
        return 'Нет связи с сервисом. Данные не изменены.';
      default:
        return error.detail || `Ошибка ${error.status}.`;
    }
  }
  return String(error instanceof Error ? error.message : error);
}

export function Banner({ children, kind }: { children: ReactNode; kind: 'info' | 'error' }) {
  return (
    <p
      className={`${styles.banner} ${kind === 'error' ? styles.error : ''}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  );
}

/**
 * Поле с подписью. Подпись связана через `htmlFor`, а не обёрткой.
 *
 * Обёртка `<label><span>Этап</span><select>…</select></label>` собирает
 * доступное имя из всего содержимого метки, включая тексты вариантов:
 * «Этаплюбойприёмрасшифровка…». Диктор читает эту склейку вслух, а поиск по
 * точной подписи не находит ничего. У поля ввода этого не видно — у него нет
 * содержимого, — поэтому ошибка доживает до первого выпадающего списка.
 */
export function Field({
  id,
  label,
  hint,
  width,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  return (
    <div className={styles.field} style={width ? { minWidth: width } : undefined}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {hint ? <span className={styles.label}>{hint}</span> : null}
    </div>
  );
}

export type ScreenProps = {
  title: string;
  hint?: string;
  children: ReactNode;
};

export function Screen({ title, hint, children }: ScreenProps) {
  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      {children}
    </section>
  );
}

/**
 * Загрузка, отказ и пустота — три разных состояния, и путать их нельзя.
 *
 * Пустая таблица во время загрузки читается как «ничего нет», и человек уходит
 * с неверным выводом. Поэтому «идёт загрузка» говорится словами.
 */
export function AsyncTable({
  isLoading,
  error,
  isEmpty,
  emptyText,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  if (error) return <Banner kind="error">{errorText(error)}</Banner>;
  if (isLoading) return <p className={styles.empty}>Загрузка…</p>;
  if (isEmpty) return <p className={styles.empty}>{emptyText}</p>;
  return <div className={styles.tableWrap}>{children}</div>;
}

/** Состояние задания или полосы: цвет плюс слово, никогда только цвет. */
export function Pill({ value, tone }: { value: string; tone: 'ok' | 'warn' | 'bad' | 'plain' }) {
  const cls =
    tone === 'ok'
      ? styles.pillOk
      : tone === 'warn'
        ? styles.pillWarn
        : tone === 'bad'
          ? styles.pillBad
          : '';
  return <span className={`${styles.pill} ${cls}`}>{value}</span>;
}

export const JOB_STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'plain'> = {
  queued: 'plain',
  running: 'warn',
  done: 'ok',
  failed: 'bad',
  dead: 'bad',
};

export const JOB_STATUS_LABEL: Record<string, string> = {
  queued: 'в очереди',
  running: 'выполняется',
  done: 'готово',
  failed: 'сбой',
  dead: 'исчерпано',
};

export const JOB_KIND_LABEL: Record<string, string> = {
  ingest: 'приём',
  transcribe: 'расшифровка',
  mask: 'обезличивание',
  analyze: 'анализ',
};

export const JOB_LANE_LABEL: Record<string, string> = {
  daily: 'суточная',
  backfill: 'история',
};

export const AUDIT_EVENT_LABEL: Record<string, string> = {
  'topic.create': 'тема создана',
  'topic.update': 'тема изменена',
  'topic.deactivate': 'тема отключена',
  'classifier.toggle': 'узел классификатора',
  'settings.update': 'настройки изменены',
  'job.retry': 'задание повторено',
  'call.reprocess': 'звонок переобработан',
  'project.dimensions': 'разметка проекта',
  'project.ingest_toggle': 'приём проекта',
  'project.sync': 'справочники из NCC',
  'report.calls': 'отчёт в Excel',
  'report.quality_review': 'файл сверки оценок',
  'report.dashboard': 'выгрузка дашборда',
  'backfill.start': 'история запущена',
  'backfill.pause': 'история приостановлена',
  'pii.reveal': 'раскрытие скрытого',
  'audio.download': 'скачивание записи',
  'export.list': 'выгрузка списка',
};

/** Секунды в «2 ч 15 мин» — возраст самого старого задания в полосе. */
export function formatAge(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} с`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}
