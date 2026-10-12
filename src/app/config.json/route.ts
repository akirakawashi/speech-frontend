import { NextResponse } from 'next/server';
import { buildRuntimeConfig } from '@/lib/runtime-config';

/**
 * Настройки, читаемые **в момент запроса**, а не запечённые в бандл.
 *
 * Это прямое следствие дефектов 17/19/22/28 журнала альфа-миграции: там
 * `VITE_*` подставлялись при сборке, и образ, собранный для одного стенда,
 * молча ходил на его адреса с другого. Один образ должен работать в local, в
 * alpha и в продуктиве, отличаясь только окружением контейнера.
 *
 * Ответ не кэшируется — иначе первый же запрос заморозил бы конфигурацию до
 * перезапуска, и смена адреса API потребовала бы пересборки, ради
 * отсутствия которой всё и затевалось.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET(): NextResponse {
  return NextResponse.json(buildRuntimeConfig(), {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
