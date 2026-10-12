import type { CallSource } from './types';

export const SEGMENTS = ['b2b', 'individual'] as const;

export const PRODUCTS = ['wallet', 'mobile', 'broadband'] as const;

/** Вкладки «Диалогов» (S-35), по порядку показа. Первая — умолчание. */
export const SOURCES = ['ncc', 'telphin'] as const satisfies readonly CallSource[];

export type Segment = (typeof SEGMENTS)[number];

export type Product = (typeof PRODUCTS)[number];

/**
 * Вкладка по умолчанию — входящие NCC, как и умолчание сервера: ссылки,
 * разосланные до появления Телфина, адреса без `source` и открывают то, что
 * показывали до него.
 */
export const DEFAULT_SOURCE: CallSource = 'ncc';
