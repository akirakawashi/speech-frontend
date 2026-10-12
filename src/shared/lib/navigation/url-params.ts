'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

/**
 * Отдаёт параметры адресной строки обычным `URLSearchParams`.
 *
 * Состояние экранов живёт в адресе, и разбирают его чистые функции, которым
 * нужен именно `URLSearchParams`. Объект остаётся тем же, пока строка запроса не
 * изменилась: разбор состояния по нему можно запоминать.
 *
 * Next.js считает, что вне App Router параметров может не быть, и типизирует
 * результат своего хука как возможный `null`; здесь `null` — пустые параметры.
 *
 * @returns Параметры текущего адреса; пустые, если строки запроса нет.
 */
export function useUrlParams(): URLSearchParams {
  const query = useSearchParams()?.toString() ?? '';
  return useMemo(() => new URLSearchParams(query), [query]);
}
