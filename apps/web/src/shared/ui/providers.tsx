'use client';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { CssBaseline, ThemeProvider } from '@mui/material';
import type { ReactNode } from 'react';
import { theme } from './theme';

/**
 * Глобальные провайдеры UI (2.2): тема + SSR-совместимый кэш Emotion
 * (без FOUC в App Router). app/providers.tsx — тонкая обёртка над этим.
 */
export function UiProviders({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: false }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
