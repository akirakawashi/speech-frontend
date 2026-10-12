'use client';

import { nodeLabel, type PickerNode, pickerLevels } from '@/lib/classifier';
import styles from './ClassifierPicker.module.css';

/**
 * Выбор узла классификатора по уровням (SP-310): селект на уровень.
 *
 * Уровень 1, под выбранным узлом — его уточнения. Смена уровня сбрасывает всё,
 * что ниже: «Wi-Fi» под «В2В» — другой узел, и оставленный выбор уточнения
 * указывал бы не туда. «Любое уточнение» возвращает выбор к узлу уровнем выше.
 */
export function ClassifierPicker<T extends PickerNode>({
  id,
  label,
  nodes,
  value,
  onChange,
  controlClassName,
  count,
}: {
  /** `id` первого селекта: к нему привязана подпись поля. */
  id: string;
  /** Подпись поля — для селектов уточнений, у которых своей подписи нет. */
  label: string;
  nodes: readonly T[];
  value: string;
  onChange: (nodeId: string) => void;
  controlClassName?: string;
  /** Число звонков рядом с названием — там, где список его знает. */
  count?: (node: T) => number;
}) {
  const levels = pickerLevels(nodes, value);

  if (levels.length === 0) {
    // Дерево ещё не пришло или пустое: поле на месте, выбрать в нём нечего.
    return (
      <div className={styles.picker}>
        <select id={id} className={controlClassName} value="" disabled>
          <option value="">любая</option>
        </select>
      </div>
    );
  }

  return (
    <div className={styles.picker}>
      {levels.map((level, index) => (
        <select
          key={level.level}
          id={index === 0 ? id : `${id}-${level.level}`}
          aria-label={index === 0 ? undefined : `${label}, уровень ${level.level}`}
          className={controlClassName}
          value={level.selected}
          onChange={(event) => onChange(event.target.value || (levels[index - 1]?.selected ?? ''))}
        >
          <option value="">{index === 0 ? 'любая' : 'любое уточнение'}</option>
          {level.options.map((node) => (
            <option key={node.id} value={node.id}>
              {count ? `${nodeLabel(node)} (${count(node)})` : nodeLabel(node)}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
