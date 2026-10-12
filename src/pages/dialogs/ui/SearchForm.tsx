'use client';

import { MODE_LABEL, type SearchMode } from '@/features/call-search';
import styles from './SearchForm.module.css';

/**
 * Показывает строку поиска с подписью режима (SRC-01).
 *
 * @param props Свойства компонента.
 * @param props.draft Набранный, но ещё не отправленный запрос.
 * @param props.mode Режим, в котором запрос будет выполнен; подпись под строкой.
 * @param props.onDraft Вызывается с новым текстом при каждом изменении поля.
 * @param props.onSubmit Вызывается при отправке формы.
 * @returns Форма поиска и подпись режима под ней.
 */
export function SearchForm({
  draft,
  mode,
  onDraft,
  onSubmit,
}: {
  draft: string;
  mode: SearchMode;
  onDraft: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section>
      <form
        className={styles.searchRow}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input
          className={styles.input}
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          placeholder="Слово или фраза в кавычках"
          aria-label="Поисковый запрос"
        />
        <button type="submit" className={styles.button}>
          Искать
        </button>
      </form>
      <p className={styles.mode}>{MODE_LABEL[mode]}</p>
    </section>
  );
}
