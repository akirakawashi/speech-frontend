import type { Schemas } from '@/shared/api';

/** Ответ дашборда: корзины периода, темы и числа выбранной темы. */
export type DashboardResponse = Schemas['DashboardResponse'];
/** Тема дашборда: число обращений, доля и доля негатива. */
export type DashboardTheme = Schemas['DashboardTheme'];
/** Корзина периода: день, неделя или месяц со счётом по темам. */
export type DashboardBucket = Schemas['DashboardBucket'];
/** Числа выбранной темы или всех тем сразу. */
export type DashboardSelection = Schemas['DashboardSelection'];
/** Подтема выбранной темы. */
export type DashboardSubtopic = Schemas['DashboardSubtopic'];
