/**
 * Переводит код отказа оценки в слова — отдельно от звонков, к которым скрипт не применим.
 *
 * @param detail Код отказа из ответа сервера.
 * @returns Текст для человека или `undefined`, если код к оценке не относится.
 */
export function qualityFailureMessage(detail: string): string | undefined {
  if (detail === 'quality_roles_undetermined') {
    return 'Не удалось оценить звонок: роли оператора и клиента не определены.';
  }
  if (detail === 'quality_invalid_evaluation') {
    return 'Не удалось оценить звонок: ответ модели не прошёл проверку.';
  }
  if (detail === 'quality_model_error') {
    return 'Не удалось оценить звонок: модель не ответила.';
  }
  if (detail.startsWith('quality_')) return 'Не удалось оценить звонок.';
  return undefined;
}
