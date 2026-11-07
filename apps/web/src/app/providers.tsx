'use client';

import type { ReactNode } from 'react';
import { ToastProvider, UiProviders } from '@/shared/ui';

/**
 * Глобальные провайдеры приложения (app-слой): тонкая обёртка над
 * shared/ui (тема, Emotion-кэш, тосты). Бизнес-логики нет.
 *
 * NB: DatePickersProvider НЕ монтируется глобально — ни одна страница не
 * использует поля дат, а провайдер тянул @mui/x-date-pickers + date-fns-локаль
 * в бандл каждой маршрута (349 КБ). Подключать локально там, где появится
 * DateField/DateRangeField.
 */
export function Providers({ children }: { children: ReactNode }): ReactNode {
  return (
    <UiProviders>
      <ToastProvider>{children}</ToastProvider>
    </UiProviders>
  );
}
