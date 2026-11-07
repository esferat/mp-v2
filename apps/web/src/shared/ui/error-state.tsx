'use client';

import { Alert, Box, Button, Typography } from '@mui/material';
// Импорт напрямую из errors.ts (НЕ через index): index тянет серверный код
// (auth/gateway), а этот компонент используется в тестах/клиенте
import { ApiError, toApiError } from '../api/errors';

/**
 * Экран ошибки (задачи 2.4/2.6): сообщение + requestId + «Повторить».
 *
 * Разделение (AC 2.4):
 * - бизнес-ошибки (400/404/409) → `tone: 'warning'`, действие — локальный UI;
 * - 5xx/сеть → `tone: 'error'`, общий экран с retry.
 */
export function ErrorState({
  error,
  onRetry,
  title = 'Что-то пошло не так',
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}): React.JSX.Element {
  const apiError: ApiError = toApiError(error);
  const serverFault = apiError.isServerError || apiError.isNetworkError;

  return (
    <Box sx={{ py: 4, px: 2, textAlign: 'center' }} data-testid="error-state">
      <Typography variant="h6" gutterBottom>
        {serverFault ? title : 'Запрос не выполнен'}
      </Typography>
      <Alert severity={serverFault ? 'error' : 'warning'} sx={{ mb: 2, textAlign: 'left' }}>
        {apiError.message}
        {apiError.requestId ? (
          <Typography variant="caption" sx={{ display: 'block' }} data-testid="error-request-id">
            requestId: {apiError.requestId}
          </Typography>
        ) : null}
      </Alert>
      {onRetry && serverFault ? (
        <Button variant="contained" onClick={onRetry}>
          Повторить
        </Button>
      ) : null}
    </Box>
  );
}
