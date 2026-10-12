# Окружение и сборка

Фронтенд использует Node.js 22 и pnpm 9.15.9, указанный в `packageManager`
файла `package.json`. Зависимости фиксирует `pnpm-lock.yaml`.
UV применяется к Python-проектам speech-backend и speech-worker.

## Установка и проверки

Команды выполняются из speech-frontend:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm dev
```

`--frozen-lockfile` требует согласованности `package.json` и `pnpm-lock.yaml`
и сохраняет закреплённые версии. `pnpm check` запускает проверки типов,
линтеры, тесты и сборку Next.js. Docker использует ту же установку по lock-файлу.

## Генерируемые файлы

`node_modules/` содержит установленные зависимости. `.next/` — результат
сборки и кэш Next.js, `tsconfig.tsbuildinfo` — кэш проверки TypeScript.
Они не входят в Git и создаются заново при установке и сборке.
Исходники приложения, Git-репозиторий и локальные `.env` сохраняются.

12.10.2026 окружение пересоздано с сохранением `package.json`,
`pnpm-lock.yaml` и исходного кода. Интерфейс и HTTP-контракт при этом
не менялись.
