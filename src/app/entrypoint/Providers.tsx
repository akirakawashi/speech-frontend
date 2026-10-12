'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { SessionProvider } from '@/entities/session';
import { ApiError } from '@/shared/api';

/**
 * Создаёт клиент TanStack Query с настройками приложения.
 *
 * Клиент создаётся внутри состояния, а не в модуле.
 *
 * Модульный экземпляр в Next живёт на сервере между запросами — то есть кэш
 * одного пользователя достаётся следующему. Здесь это были бы результаты поиска
 * по чужим разговорам.
 *
 * @returns Новый клиент: данные свежи минуту, повтор — только при отказе сети или сервиса.
 */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Данные суточные: звонок, открытый минуту назад, за минуту не
        // изменился. Пере-запрос при каждом возврате на вкладку — это нагрузка
        // на поиск ради данных, которые не поменялись.
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Повторять `403` бессмысленно и вредно: право не появится, а в
          // журнале доступа вырастет три записи вместо одной.
          if (error instanceof ApiError) {
            if (error.kind === 'network' || error.kind === 'unavailable') return failureCount < 2;
            return false;
          }
          return failureCount < 1;
        },
      },
      mutations: { retry: false },
    },
  });
}

/**
 * Оборачивает приложение в провайдеры: кэш запросов и сессию пользователя.
 *
 * @param props Свойства компонента.
 * @param props.children Дерево приложения.
 * @returns Дерево внутри провайдеров.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return (
    <QueryClientProvider client={client}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
