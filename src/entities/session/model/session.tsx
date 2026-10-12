'use client';

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, request } from '@/shared/api';
import { loadConfig } from '@/shared/config';
import { issueAudioTicket } from '../api/audio-ticket';
import { isOpenMode, startLogin, takeAuthError } from '../lib/auth';
import type { MeResponse } from './types';

/** Права закрытым набором: опечатка в проверке должна быть отказом. */
export const PERM_DOWNLOAD_AUDIO = 'download_audio';
export const PERM_EXPORT = 'export';
/** Оценки звонков по скрипту и сводка по сотрудникам. */
export const PERM_QUALITY = 'quality';
export const PERM_ADMIN = 'admin';

export type SessionState =
  | { status: 'loading' }
  | { status: 'anonymous'; error: string | null }
  | { status: 'ready'; me: MeResponse }
  | { status: 'failed'; error: string };

export type Session = SessionState & {
  can: (permission: string) => boolean;
};

const SessionContext = createContext<Session>({ status: 'loading', can: () => false });

/**
 * Отдаёт сессию текущего пользователя.
 *
 * @returns Состояние сессии и проверка права `can`.
 */
export function useSession(): Session {
  return useContext(SessionContext);
}

/**
 * Загружает сессию пользователя и раздаёт её приложению.
 *
 * Права спрашиваются у сервера, а не выводятся из ролей в токене.
 *
 * Разбирая роли на клиенте, мы завели бы вторую ролевую модель рядом с той, что
 * решает на самом деле, — и она разошлась бы с ней молча: кнопка есть, ручка
 * отказывает. `/me` возвращает готовый список прав именно для этого (AUT-04).
 *
 * @param props Свойства компонента.
 * @param props.children Дерево приложения.
 * @returns Провайдер контекста сессии вокруг дерева.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    /**
     * Загружает конфигурацию и сессию и записывает итог в состояние.
     */
    async function boot(): Promise<void> {
      try {
        const config = await loadConfig();
        if (!isOpenMode(config)) {
          // Сервис приводит сюда с `?auth_error=<код>`, когда вход не
          // состоялся. Разобрать это надо ДО запроса `/me`: иначе `401` увёл
          // бы человека на вход по кругу, ни разу не показав причину — а при
          // «нет групп» круг бесконечен, потому что пароль-то верный.
          const authError = takeAuthError();
          if (authError) {
            if (!cancelled) setState({ status: 'failed', error: authError });
            return;
          }
        }
        // Есть ли сессия — знает только сервер: кука `HttpOnly`, и прочитать
        // её здесь нельзя. Поэтому спрашиваем, а не гадаем; `401` означает
        // «сессии нет» и разбирается ниже.
        const me = await request<MeResponse>('/api/v1/me');
        // Кука для тега `<audio>` (SP-808). Отказ здесь не должен ронять вход:
        // без неё не работает только прослушивание, а поиск и карточки — да.
        // Молчать о нём тоже нельзя, иначе «плеер не играет» будет
        // расследоваться вслепую.
        await issueAudioTicket().catch((error) => {
          console.warn('speech: не удалось выдать куку для аудио', error);
        });
        if (!cancelled) setState({ status: 'ready', me });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.kind === 'unauthorized') {
          setState({ status: 'anonymous', error: null });
          return;
        }
        if (error instanceof ApiError && error.kind === 'forbidden') {
          // Токен валиден, групп нет. Логиниться заново незачем — нужна группа,
          // и человеку надо сказать именно это, а не «войдите ещё раз».
          setState({
            status: 'failed',
            error: 'Доступ не выдан: учётной записи не назначена ни одна группа Speech Analytics.',
          });
          return;
        }
        setState({
          status: 'failed',
          error: String(error instanceof Error ? error.message : error),
        });
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<Session>(() => {
    const permissions = state.status === 'ready' ? new Set(state.me.permissions ?? []) : new Set();
    return { ...state, can: (permission: string) => permissions.has(permission) };
  }, [state]);

  useEffect(() => {
    // Анонимный посетитель в режиме `keycloak` отправляется на вход сразу:
    // экран без данных и с одной кнопкой — это лишний шаг, а не выбор.
    if (value.status === 'anonymous' && value.error === null) {
      void startLogin().catch(() => undefined);
    }
  }, [value]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
