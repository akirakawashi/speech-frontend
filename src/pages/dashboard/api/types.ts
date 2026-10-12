import type { Schemas } from '@/shared/api';

/** Ответ дашборда: корзины периода, темы и числа выбранной темы. */
export type DashboardResponse = Schemas['DashboardResponse'];
/** Тема дашборда: число обращений, доля и доля негатива. */
export type DashboardTheme = Schemas['DashboardTheme'];
