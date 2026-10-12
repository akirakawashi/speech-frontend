'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { ApiError } from '@/api/client';
import { SessionProvider } from '@/lib/session';

/**
 * Клиент создаётся внутри состояния, а не в модуле.
 *
 * Модульный экземпляр в Next живёт на сервере между запросами — то есть кэш
 * одного пользователя достаётся следующему. Здесь это были бы результаты поиска
 * по чужим разговорам.
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

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return (
    <QueryClientProvider client={client}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
