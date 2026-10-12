import type { Schemas } from '@/shared/api';

/** Карточка звонка: реквизиты, классификация и реплики расшифровки. */
export type CallResponse = Schemas['CallResponse'];
/** Реплика расшифровки: кто говорит, когда и что сказано. */
export type SegmentModel = Schemas['SegmentModel'];
/** Цитата с совпадением в выдаче поиска. */
export type QuoteModel = Schemas['QuoteModel'];
/** Справочник для фильтра: операторы или проекты источника. */
export type OptionsResponse = Schemas['OptionsResponse'];
/** Чьи звонки (S-35): входящие NCC или исходящие ШПД Телфина. */
export type CallSource = Schemas['CallSource'];
