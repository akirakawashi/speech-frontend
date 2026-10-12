'use client';

import { useEffect, useState } from 'react';
import { useSearch } from '@/api/queries';
import styles from '@/app/quality/quality.module.css';
import { formatCount } from '@/lib/format';
import {
  type QualityState,
  qualitySearch,
  type ScoreTone,
  scoreTone,
  toQualityParams,
} from '@/lib/quality';
import { EMPTY_STATE, MODE_LABEL, queryMode } from '@/lib/search-params';
import { CallPanel } from '../CallPanel';
import { ResultCard } from '../ResultCard';

const TONE: Record<ScoreTone, string | undefined> = {
  good: styles.good,
  fair: styles.fair,
  poor: styles.poor,
};

/** Балл звонка в углу карточки, цветом шкалы. У звонка без оценки его нет. */
function Score({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return null;
  return (
    <span className={`${styles.searchScore} ${TONE[scoreTone(score)] ?? ''}`}>
      <span className={styles.srOnly}>оценка </span>
      {score}%
    </span>
  );
}

/**
 * Поиск по словам — блок макета заказчика: найти разговоры, где прозвучало
 * слово, и сразу видеть, как каждый оценён.
 *
 * Это поиск диалогов, а не свой: та же ручка, те же карточки и та же панель
 * разговора. От экрана оценки — охват (период и сотрудник, звонки, которые
 * оцениваются по скрипту) и балл в углу карточки.
 *
 * Разговор открывается здесь же, справа от выдачи: уводить на «Диалоги» значило
 * бы терять экран, с которого искали.
 */
export function Search({
  state,
  onChange,
}: {
  state: QualityState;
  onChange: (next: QualityState) => void;
}) {
  const [draft, setDraft] = useState(state.q);
  // Запрос приходит и извне: кнопка «назад», чужая ссылка.
  useEffect(() => setDraft(state.q), [state.q]);

  const query = state.q.trim();
  const request = qualitySearch(state);
  const search = useSearch(request ?? EMPTY_STATE, Boolean(request && query));
  const pages = search.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items ?? []);
  const found = pages[0];
  const opened = items.find((item) => item.call_id === state.hit);

  /** Адрес того же экрана с разговором в панели. Секунда — у цитаты. */
  const hrefFor = (callId: string) => (seconds?: number) =>
    `/quality?${toQualityParams({
      ...state,
      hit: callId,
      hitAt: seconds ? Math.floor(seconds) : 0,
    }).toString()}`;

  return (
    <section className={styles.card} aria-label="Поиск по словам">
      <h2 className={styles.cardTitle}>Поиск по словам</h2>

      <form
        className={styles.searchRow}
        onSubmit={(event) => {
          event.preventDefault();
          // Новый запрос — новая выдача: разговор из прежней в ней может не оказаться.
          onChange({ ...state, q: draft.trim(), hit: '', hitAt: 0 });
        }}
      >
        <input
          className={styles.searchInput}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Слово или фраза в кавычках"
          aria-label="Слова для поиска в разговорах"
        />
        {draft.trim() ? (
          <span className={styles.searchMode}>{MODE_LABEL[queryMode(draft)]}</span>
        ) : null}
        <button type="submit" className={styles.searchGo}>
          Найти
        </button>
      </form>

      {!request ? (
        <p className={styles.hint}>
          Среди звонков без оператора поиск не работает: выберите сотрудника или «Все сотрудники».
        </p>
      ) : !query ? (
        <p className={styles.hint}>
          Введите слово или фразу — найдём разговоры за выбранный период и покажем их оценки.
        </p>
      ) : search.isPending ? (
        <p className={styles.hint}>Ищем…</p>
      ) : search.isError ? (
        <p className={`${styles.hint} ${styles.alert}`} role="alert">
          Не удалось выполнить поиск.
        </p>
      ) : items.length === 0 ? (
        <p className={styles.hint}>
          По запросу «{query}» совпадений нет. Проверьте написание или расширьте период.
        </p>
      ) : (
        <>
          <p className={styles.searchCount}>
            Найдено{' '}
            {formatCount(found?.total_matches ?? 0, 'совпадение', 'совпадения', 'совпадений')} в{' '}
            {formatCount(found?.total_calls ?? 0, 'разговоре', 'разговорах', 'разговорах')}
          </p>
          <div className={styles.searchGrid}>
            <div className={styles.searchResults}>
              {items.map((item) => (
                <ResultCard
                  key={item.call_id}
                  item={item}
                  state={request}
                  selected={item.call_id === state.hit}
                  hrefFor={hrefFor(item.call_id)}
                  inPlace
                  badge={<Score score={item.quality_score} />}
                />
              ))}
              <div className={styles.searchFoot}>
                <span className={styles.hint}>
                  Показано {items.length} из {found?.total_calls ?? items.length}
                </span>
                {search.hasNextPage ? (
                  <button
                    type="button"
                    className={styles.more}
                    disabled={search.isFetchingNextPage}
                    onClick={() => void search.fetchNextPage()}
                  >
                    {search.isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'}
                  </button>
                ) : null}
              </div>
            </div>
            <div className={styles.searchSide}>
              {state.hit ? (
                <>
                  {/* Панель здесь — запись и текст. Оценка по этапам с пояснениями
                      в неё не помещается и открывается разбором поверх экрана. */}
                  <p className={styles.searchVerdict}>
                    {/* Разговор из адреса может не входить в выдачу: тогда о его
                        балле здесь ничего не известно, и молчать честнее. */}
                    {typeof opened?.quality_score === 'number' ? (
                      <span>
                        Оценка звонка{' '}
                        <strong className={TONE[scoreTone(opened.quality_score)]}>
                          {opened.quality_score}%
                        </strong>
                      </span>
                    ) : (
                      <span>{opened ? 'Балла у звонка нет' : ''}</span>
                    )}
                    <button
                      type="button"
                      className={styles.ghost}
                      onClick={() => onChange({ ...state, call: state.hit })}
                    >
                      Разбор оценки
                    </button>
                  </p>
                  <CallPanel
                    // Другой разговор — другой плеер: позиция и скорость прежнего не переносятся.
                    key={state.hit}
                    callId={state.hit}
                    query={state.q}
                    startAt={state.hitAt}
                    onClose={() => onChange({ ...state, hit: '', hitAt: 0 })}
                    compact
                  />
                </>
              ) : (
                <p className={styles.searchEmpty}>
                  Выберите разговор слева — здесь откроются запись и текст.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
