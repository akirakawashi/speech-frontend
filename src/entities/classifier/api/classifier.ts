import { useQuery } from '@tanstack/react-query';
import { DIRECTORY_STALE_MS, request } from '@/shared/api';
import type { ClassifierResponse } from '../model/types';

/**
 * Загружает дерево классификатора обращений для фильтра «Классификация» (SP-310).
 *
 * Узлы приходят плоско; выбор по уровням собирает `pickerLevels`. Ключ кэша тот же, что
 * перечитывает админка после выключения узла.
 *
 * @returns Состояние запроса TanStack Query с узлами дерева плоским списком.
 */
export function useClassifier() {
  return useQuery({
    queryKey: ['classifier'],
    queryFn: () => request<ClassifierResponse>('/api/v1/classifier'),
    staleTime: DIRECTORY_STALE_MS,
  });
}
