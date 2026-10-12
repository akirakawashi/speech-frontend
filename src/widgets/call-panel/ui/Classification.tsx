'use client';

import type { CallResponse } from '@/entities/call';
import { CLASSIFIER_DEPTH, EMPTY_LEVEL_LABEL, pathCaption } from '@/entities/classifier';
import styles from './Classification.module.css';
import common from './common.module.css';

const LEVELS = Array.from({ length: CLASSIFIER_DEPTH }, (_, index) => index + 1);

/**
 * Подписывает уровень пути на своём месте: уровня нет — прочерк, пустой уровень — словами.
 *
 * @param path Путь по классификатору: подписи уровней от первого.
 * @param level Номер уровня, начиная с единицы.
 * @returns Подпись уровня; прочерк, если путь короче; «(пусто)», если уровень без подписи.
 */
function levelText(path: readonly string[], level: number): string {
  if (level > path.length) return '—';
  return path[level - 1] || EMPTY_LEVEL_LABEL;
}

/**
 * Показывает классификацию звонка (SP-310): путь ИИ и путь оператора по одному дереву, уровень
 * против уровня.
 *
 * Совпадение — правило владельца: пустой уровень оператора или прочерк не совпадает, итог —
 * совпавших уровней из пяти.
 *
 * Ниже — тема по предложению ИИ помощника (SP-309): мнение модели сверх
 * разметки, и своя формулировка помечена как новая.
 *
 * @param props Свойства компонента.
 * @param props.data Карточка звонка.
 * @returns Таблица уровней с итогом совпадения или `null`, если классификации нет.
 */
export function Classification({ data }: { data: CallResponse }) {
  const ai = data.ai_path ?? [];
  const operator = data.operator_path ?? [];
  const marks = data.level_match ?? [];
  const suggestion = data.ai_suggestion ?? [];
  if (ai.length === 0 && operator.length === 0 && suggestion.length === 0) return null;
  const matched = marks.filter(Boolean).length;
  return (
    <section className={styles.classification} aria-label="Классификация">
      <table className={styles.levels}>
        <thead>
          <tr>
            <th scope="col">Уровень</th>
            <th scope="col">ИИ</th>
            <th scope="col">Оператор</th>
            <th scope="col">Совпало</th>
          </tr>
        </thead>
        <tbody>
          {LEVELS.map((level) => (
            <tr key={level}>
              <td className={styles.levelNumber}>{level}</td>
              <td>{levelText(ai, level)}</td>
              <td>{levelText(operator, level)}</td>
              <td className={styles.levelMark}>
                {marks.length === 0 ? '—' : marks[level - 1] ? 'да' : 'нет'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.match}>
        {marks.length > 0
          ? `Совпадение с оператором: ${matched} из ${CLASSIFIER_DEPTH} уровней (${
              (matched / CLASSIFIER_DEPTH) * 100
            }%).`
          : operator.length === 0
            ? 'Сравнить не с чем: оператор звонок не классифицировал.'
            : 'Сравнить не с чем: классификации ИИ нет.'}
      </p>
      {suggestion.length > 0 ? (
        <p className={common.aiTopic}>
          <span className={common.aiTopicLabel}>Тема по предложению ИИ помощника:</span>{' '}
          {pathCaption(suggestion)}
          {data.ai_suggestion_is_new ? <span className={common.aiTopicNew}>новая</span> : null}
        </p>
      ) : null}
    </section>
  );
}
