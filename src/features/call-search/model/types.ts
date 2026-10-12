import type { Schemas } from '@/shared/api';

/** Счёты периода над выдачей: обработано, расшифровано, в очереди и главные темы. */
export type StatsResponse = Schemas['StatsResponse'];
/** Страница выдачи поиска с итогами по всему найденному. */
export type SearchResponse = Schemas['SearchResponse'];
/** Найденный разговор: реквизиты, цитаты с совпадениями и балл оценки. */
export type SearchItemModel = Schemas['SearchItemModel'];
