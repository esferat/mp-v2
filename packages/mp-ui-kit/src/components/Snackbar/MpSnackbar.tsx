import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Snackbar, { type SnackbarProps } from '@mui/material/Snackbar';
import { forwardRef, type ReactNode } from 'react';

export interface MpSnackbarProps extends Omit<SnackbarProps, 'children' | 'message'> {
  /** Текст тоста. */
  message: ReactNode;
  /**
   * Семантика: показывает `Alert` вместо простого тоста.
   * Используйте для ошибок и успеха (см. design/README: тост + requestId + «Повторить»).
   */
  severity?: 'success' | 'info' | 'warning' | 'error';
  /** Действие справа (например, кнопка «Повторить»). */
  action?: ReactNode;
}

/**
 * Тост (snackbar) mp-ui-kit.
 *
 * @example
 * <MpSnackbar
 *   open={open}
 *   onClose={handleClose}
 *   severity="error"
 *   message="Не удалось загрузить данные (requestId: 8f3a…)"
 *   action={<MpButton size="small" onClick={retry}>Повторить</MpButton>}
 * />
 */
export const MpSnackbar = forwardRef<HTMLDivElement, MpSnackbarProps>(function MpSnackbar(
  {
    message,
    severity,
    action,
    autoHideDuration = 6000,
    anchorOrigin = { vertical: 'bottom', horizontal: 'center' },
    ...props
  },
  ref,
) {
  return (
    <Snackbar ref={ref} autoHideDuration={autoHideDuration} anchorOrigin={anchorOrigin} {...props}>
      {severity ? (
        <Alert severity={severity} variant="filled" action={action} sx={{ alignItems: 'center' }}>
          {message}
        </Alert>
      ) : (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            bgcolor: 'background.paper',
            color: 'text.primary',
            px: 2,
            py: 1,
            borderRadius: 2,
            fontSize: 14,
            boxShadow: 6,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ flexGrow: 1 }}>{message}</Box>
          {action}
        </Box>
      )}
    </Snackbar>
  );
});
