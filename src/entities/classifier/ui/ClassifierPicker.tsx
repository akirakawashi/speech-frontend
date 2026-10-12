'use client';

import { nodeLabel, type PickerNode, pickerLevels } from '../model/classifier';
import styles from './ClassifierPicker.module.css';

/**
 * Выбор узла классификатора по уровням (SP-310): селект на уровень.
 *
 * Уровень 1, под выбранным узлом — его уточнения. Смена уровня сбрасывает всё,
 * что ниже: «Wi-Fi» под «В2В» — другой узел, и оставленный выбор уточнения
 * указывал бы не туда. «Любое уточнение» возвращает выбор к узлу уровнем выше.
 *
 * @param props Свойства компонента.
 * @param props.id `id` первого селекта: к нему привязана подпись поля.
 * @param props.label Подпись поля — для селектов уточнений, у которых своей подписи нет.
 * @param props.nodes Узлы классификатора плоским списком.
 * @param props.value Идентификатор выбранного узла; пустая строка — ничего не выбрано.
 * @param props.onChange Вызывается с идентификатором нового узла; пустая строка — выбор снят.
 * @param props.controlClassName Класс каждого выпадающего списка.
 * @param props.count Число звонков рядом с названием — там, где список его знает.
 * @returns Ряд выпадающих списков: по одному на уровень.
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
  id: string;
  label: string;
  nodes: readonly T[];
  value: string;
  onChange: (nodeId: string) => void;
  controlClassName?: string;
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
