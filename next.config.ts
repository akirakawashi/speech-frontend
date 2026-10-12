import type { NextConfig } from 'next';

/**
 * Собирается в standalone: образ несёт `server.js` и только те модули, которые
 * действительно импортируются, а не весь `node_modules`. Иначе образ фронта
 * весит сотни мегабайт, из которых работают единицы.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // Сборка не должна быть местом, где узнают о неисправном типе: это задача
  // `pnpm typecheck`. Но и молча пропускать его здесь нельзя — иначе образ
  // соберётся из кода, который не проходит проверку.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },

  // Проброса `/api` здесь больше нет. `rewrites()` вычисляется при сборке, и
  // переменная разработки из `.env.local` однажды запеклась в образ: контейнер
  // пересылал `/api` на `127.0.0.1:18096`, в самого себя. Теперь `/api/*`
  // пробрасывает обработчик `src/app/api/[...path]/route.ts`, читая адрес
  // `speech-ms` в момент запроса, — одинаково в разработке и в контейнере.
};

export default nextConfig;
