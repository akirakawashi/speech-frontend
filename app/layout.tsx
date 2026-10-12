import type { Metadata, Viewport } from 'next';
import { Providers } from '@/app/entrypoint';
import '@/app/styles/globals.css';

export const metadata: Metadata = {
  title: 'Speech Analytics',
  description: 'Поиск по расшифровкам разговоров',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b0e15',
};

/**
 * Корневая разметка приложения: язык документа, шрифты и провайдеры.
 *
 * @param props Свойства компонента.
 * @param props.children Содержимое открытого маршрута.
 * @returns Документ со страницей внутри провайдеров.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {/* Шрифты берутся так же, как у соседнего фронта: через CDN, а не
            `next/font`. `next/font` скачивает гарнитуру на **сборке**, и в
            контуре без выхода наружу сборка образа перестала бы собираться —
            отказ там, где его никто не ждёт. Здесь же за шрифтом идёт браузер,
            а запасная гарнитура объявлена в токенах. Inter — шрифт макета
            экрана «Оценка качества»; остальные экраны его не используют. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
