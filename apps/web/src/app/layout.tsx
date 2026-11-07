import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Header } from '@/widgets/layout';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Медицинский портал',
  description: 'Запись к врачу, документы и история приёмов',
};

/**
 * Корневой layout (fsd.md §3): только композиция провайдеров и оболочки.
 * Серверные проверки ролей — middleware/гарды (задача 1.3), не здесь.
 */
export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="ru">
      <body>
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
