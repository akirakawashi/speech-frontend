import { proxyApiRequest } from '@/lib/api-proxy';

/**
 * `/api/*` — пересылка на `speech-ms`; почему и как — в `@/lib/api-proxy`.
 *
 * Каждый запрос живой: адрес `speech-ms` читается при обращении, и ни ответ, ни
 * сам маршрут не кэшируются.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function handle(request: Request): Promise<Response> {
  return proxyApiRequest(request);
}

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
