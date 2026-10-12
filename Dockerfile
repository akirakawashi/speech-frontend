# Фронтенд Speech Analytics.
#
# `output: 'standalone'` — образ несёт `server.js` и только те модули, которые
# действительно импортируются. Без него в образ уезжает весь `node_modules`, из
# которого в рантайме работают единицы процентов.
#
# Ни одной переменной сборки: адреса и режим входа приходят в рантайме через
# `/config.json`. Образ, собранный один раз, работает в local, alpha и
# продуктиве — это и есть смысл упражнения (дефекты 17/19/22/28 журнала
# альфа-миграции, где `VITE_*` были запечены в бандл).

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Сборка падает на ошибке типов намеренно: образ не должен собираться из кода,
# который не проходит проверку.
RUN pnpm exec next build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Свой пользователь, а не root. Образ читает только своё и ничего не пишет:
# `speech-frontend` не хранит состояния вовсе.
RUN addgroup -g 1001 -S speech && adduser -u 1001 -S speech -G speech

COPY --from=build --chown=speech:speech /app/.next/standalone ./
COPY --from=build --chown=speech:speech /app/.next/static ./.next/static
# `public/` копируется только если он есть: пустой каталог в git не хранится, а
# `COPY` несуществующего пути валит сборку.

USER speech
EXPOSE 3000

# Проверка живости обращается к `/config.json`, а не к корню: корень отдаёт
# страницу и при неработающем route handler, а именно он — единственное, что
# этот процесс обязан уметь сам.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/config.json').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
