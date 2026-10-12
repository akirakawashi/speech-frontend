'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { CallSource, SearchItemModel } from '@/api/client';
import { pathCaption } from '@/lib/classifier';
import {
  AUDIO_STATUS_NOTE,
  formatCount,
  formatDateTime,
  formatDuration,
  PRODUCT_LABEL,
  SEGMENT_LABEL,
  SENTIMENT_LABEL,
} from '@/lib/format';
import { splitHighlight } from '@/lib/highlight';
import { type SearchState, toSearchParams } from '@/lib/search-params';
import styles from './ResultCard.module.css';

/** Сколько цитат показывает карточка (SRC-04). Остальные — в панели звонка. */
const VISIBLE_QUOTES = 2;

function Quote({ text }: { text: string }) {
  return (
    <>
      {splitHighlight(text).map((piece) =>
        piece.marked ? (
          <mark key={piece.offset} className={styles.mark}>
            {piece.text}
          </mark>
        ) : (
          <span key={piece.offset}>{piece.text}</span>
        ),
      )}
    </>
  );
}

/**
 * Значение измерения с пометкой источника: `llm` — догадка, `project` — факт.
 *
 * Факт берётся из проекта звонка, и у Телфина это не очередь NCC (S-35):
 * подсказка называет, откуда значение на самом деле.
 */
function Dimension({
  value,
  source,
  callSource,
  labels,
}: {
  value: string | null | undefined;
  source: string | undefined;
  callSource: CallSource | undefined;
  labels: Record<string, string>;
}) {
  if (!value) return null;
  const guessed = source === 'llm';
  const origin = callSource === 'telphin' ? 'взято из проекта Телфина' : 'взято из очереди NCC';
  return (
    <span
      className={`${styles.chip} ${styles.dim} ${guessed ? styles.guessed : ''}`}
      title={guessed ? 'определено моделью по разговору' : origin}
    >
      {labels[value] ?? value}
      {guessed ? ' ?' : ''}
    </span>
  );
}

/**
 * Классификация ИИ стоит в карточке **всегда**, даже когда её нет.
 *
 * Пустое место на её месте читается как «не важна», а не как «анализ ещё не
 * дошёл до этого звонка» — и разбор «почему у половины карточек пусто»
 * начинается с догадок. Три состояния разведены: путь есть, анализ ещё идёт,
 * анализ закончился и путь по дереву не нашёлся.
 *
 * Путь — целиком, от уровня 1 (SP-310): «Консультация › Не работает» есть и в
 * ШПД, и в мобильной связи, и без начала пути это одна строка на две ветки.
 */
function Classification({ item }: { item: SearchItemModel }) {
  const path = item.ai_path ?? [];
  if (path.length > 0) {
    return (
      <span className={`${styles.chip} ${styles.classification}`} title="классификация ИИ">
        {pathCaption(path)}
      </span>
    );
  }
  const pending = item.processing_status !== 'done';
  return (
    <span
      className={`${styles.chip} ${styles.classificationEmpty}`}
      title={
        pending
          ? 'разговор ещё в обработке — классификация появится после анализа'
          : 'анализ прошёл, но путь по классификатору не нашёлся'
      }
    >
      {pending ? 'классификация ещё не определена' : 'классификация не определена'}
    </span>
  );
}

export function ResultCard({
  item,
  state,
  selected = false,
  hrefFor,
  inPlace = false,
  badge,
}: {
  item: SearchItemModel;
  state: SearchState;
  /** Разговор этой карточки сейчас открыт в панели. */
  selected?: boolean;
  /**
   * Куда ведёт карточка: адрес разговора, с секундой цитаты или без. По
   * умолчанию — страница разговора в «Диалогах». Экран оценки открывает
   * разговор у себя, рядом с выдачей.
   */
  hrefFor?: (seconds?: number) => string;
  /**
   * Карточка открывает разговор на том же экране: переход не прокручивает
   * страницу к началу и не копит историю — как смена фильтра.
   */
  inPlace?: boolean;
  /** Знак в правом углу шапки. На экране оценки — балл звонка. */
  badge?: ReactNode;
}) {
  const quotes = item.quotes ?? [];
  const shown = quotes.slice(0, VISIBLE_QUOTES);
  const hidden = Math.max(0, item.match_count - shown.length);
  const sentiment = item.sentiment ?? '';
  const note = AUDIO_STATUS_NOTE[item.audio_status];
  const playable = item.audio_status === 'stored';

  /**
   * Адрес несёт **всё** состояние экрана, а не один запрос.
   *
   * Страница разговора разбирает адрес заново и строит по нему ту же выдачу
   * слева. Ссылка, несущая только `q`, теряла период и фильтры — и выдача
   * рядом с открытой панелью становилась пустой. С «за всё время» это стало
   * заметно сразу: без периода в адресе сервер подставляет свои тридцать дней.
   */
  const pageHref = (seconds?: number) => {
    const params = toSearchParams(state);
    params.delete('page');
    if (seconds) params.set('t', String(Math.floor(seconds)));
    const query = params.toString();
    return `/calls/${item.call_id}${query ? `?${query}` : ''}`;
  };
  const href = hrefFor ?? pageHref;
  const link = { scroll: !inPlace, replace: inPlace };

  const when = formatDateTime(item.started_at);

  return (
    <article
      className={`${styles.card} ${selected ? styles.selected : ''} ${badge ? styles.withBadge : ''}`}
    >
      {badge ? <span className={styles.badge}>{badge}</span> : null}
      <header className={styles.head}>
        {/* Кружок — не отдельная кнопка, а знак того, что карточка открывает
            разговор и ставит его в плеер. Отдельной кнопкой он делал бы ровно
            то же, что и клик по карточке, и в дереве доступности появилась бы
            вторая ссылка на тот же адрес. */}
        <span className={`${styles.play} ${playable ? '' : styles.playOff}`} aria-hidden="true">
          {playable ? '▶' : '✕'}
        </span>

        {/* Ссылка растянута на всю карточку: клик по любому её месту открывает
            разговор. Раньше кликалась только дата — на карточке высотой в сто
            пикселей это выглядело как «карточка не нажимается». */}
        <Link href={href()} {...link} className={`${styles.when} ${styles.stretch}`}>
          {when}
        </Link>

        <span className={styles.meta}>{item.operator_login || 'оператор не указан'}</span>
        <span className={styles.meta}>{formatDuration(item.duration_s)}</span>
        {item.project_title ? <span className={styles.meta}>{item.project_title}</span> : null}

        <Classification item={item} />

        {sentiment ? (
          <span
            className={`${styles.sentiment} ${styles[sentiment] ?? ''}`}
            // Роль обязательна: `aria-label` на элементе без роли экранный
            // диктор игнорирует, и тональность превращается в «кружок» — то
            // есть в ничего.
            role="img"
            aria-label={`тональность: ${SENTIMENT_LABEL[sentiment] ?? sentiment}`}
            title={SENTIMENT_LABEL[sentiment] ?? sentiment}
          />
        ) : null}

        <span className={styles.spacer} />

        <Dimension
          value={item.segment}
          source={item.segment_source}
          callSource={item.source}
          labels={SEGMENT_LABEL}
        />
        <Dimension
          value={item.product}
          source={item.product_source}
          callSource={item.source}
          labels={PRODUCT_LABEL}
        />

        {item.match_count > 0 ? (
          <span className={styles.matches}>
            {formatCount(item.match_count, 'совпадение', 'совпадения', 'совпадений')}
          </span>
        ) : null}
      </header>

      {shown.length > 0 ? (
        <ul className={styles.quotes}>
          {shown.map((quote) => (
            <li key={quote.seq}>
              {/* Цитата ведёт в тот же разговор, но на свою секунду. Она лежит
                  поверх растянутой ссылки — иначе клик по цитате открывал бы
                  запись с начала, и найденное место пришлось бы искать заново. */}
              <Link href={href(quote.start_ms / 1000)} {...link} className={styles.quote}>
                <span className={`${styles.quotePlay} ${playable ? '' : styles.playOff}`}>
                  {playable ? '▶' : '✕'}
                </span>
                <span className={styles.timecode}>{formatDuration(quote.start_ms / 1000)}</span>
                <span className={styles.speaker}>
                  {quote.speaker === 'operator' ? 'оператор' : 'клиент'}
                </span>
                <span className={styles.quoteText}>
                  <Quote text={quote.text} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {hidden > 0 ? (
        <Link href={href()} {...link} className={styles.more}>
          +{hidden} {hidden === 1 ? 'совпадение' : 'совпадений'} · показать
        </Link>
      ) : null}

      {note ? <p className={styles.note}>{note}</p> : null}
    </article>
  );
}
