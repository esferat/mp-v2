import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Медицинский портал',
  description: 'Запись к врачу, документы и история приёмов',
};

/**
 * Корневой layout (fsd.md §3): только композиция провайдеров.
 * Оболочка разделов — SectionLayout (MpAppShell) в (admin)/(patient)/(doctor);
 * публичные страницы (лендинг, 403) подключают Header сами.
 * Серверные проверки ролей — middleware/гарды (задача 1.3), не здесь.
 */
export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="ru">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
