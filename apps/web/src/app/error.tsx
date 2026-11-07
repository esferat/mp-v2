'use client';

import type { ReactNode } from 'react';
import { Container, Paper } from '@/shared/ui';
import { ErrorState } from '@/shared/ui';

/**
 * Глобальный error boundary (задача 2.4): любой сбой рендера/данных →
 * осмысленный экран с requestId и кнопкой «Повторить» (AC: не белый экран).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactNode {
  return (
    <Container maxWidth="sm">
      <Paper sx={{ mt: 6 }}>
        <ErrorState
          error={new Error(error.message, { cause: error })}
          onRetry={reset}
          title="Не удалось отобразить страницу"
        />
      </Paper>
    </Container>
  );
}
