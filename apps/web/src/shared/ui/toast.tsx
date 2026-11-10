'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';

/**
 * Тосты (2.2): единый показ сообщений, включая ошибки API с requestId
 * (2.3/2.4: «ошибка API показывает requestId»).
 *
 * Использование:
 *   const toast = useToast();
 *   toast.error('Не удалось сохранить', requestId);
 */

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

interface ToastState {
  message: string;
  tone: ToastTone;
  requestId?: string;
}

interface ToastApi {
  show(message: string, tone?: ToastTone, requestId?: string): void;

  success(message: string): void;

  error(message: string, requestId?: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, setState] = useState<ToastState | null>(null);

  const show = useCallback((message: string, tone: ToastTone = 'info', requestId?: string) => {
    setState({ message, tone, requestId });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message) => show(message, 'success'),
      error: (message, requestId) => show(message, 'error', requestId),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar
        open={state !== null}
        autoHideDuration={6000}
        onClose={() => setState(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={state?.tone ?? 'info'} variant="filled" onClose={() => setState(null)}>
          {state?.message}
          {state?.requestId ? (
            <div data-testid="toast-request-id">requestId: {state.requestId}</div>
          ) : null}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error('useToast должен вызываться внутри ToastProvider (shared/ui)');
  }
  return api;
}
