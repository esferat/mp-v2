'use client';

import type { ReactNode } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

/** Модальное окно подтверждения/формы (2.2): заголовок, контент, действия. */
export function AppModal({
  open,
  title,
  children,
  onClose,
  confirmLabel,
  onConfirm,
  confirmDisabled,
  closeLabel = 'Отмена',
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  closeLabel?: string;
}): React.JSX.Element {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{children}</DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          {closeLabel}
        </Button>
        {confirmLabel && onConfirm ? (
          <Button onClick={onConfirm} variant="contained" disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
