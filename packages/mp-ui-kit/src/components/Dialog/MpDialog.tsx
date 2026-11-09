import Dialog, { type DialogProps } from '@mui/material/Dialog';
import DialogActions, { type DialogActionsProps } from '@mui/material/DialogActions';
import DialogContent, { type DialogContentProps } from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { forwardRef, type ReactNode } from 'react';

export interface MpDialogProps extends Omit<DialogProps, 'title'> {
  /** Заголовок окна (при наличии рендерится `DialogTitle`). */
  title?: ReactNode;
}

/**
 * Модальное окно mp-ui-kit.
 *
 * @example
 * <MpDialog title="Новый врач" open={open} onClose={close}>
 *   <MpDialogContent>…</MpDialogContent>
 *   <MpDialogActions>…</MpDialogActions>
 * </MpDialog>
 */
export const MpDialog = forwardRef<HTMLDivElement, MpDialogProps>(function MpDialog(
  { title, children, maxWidth = 'sm', fullWidth = true, ...props },
  ref,
) {
  return (
    <Dialog ref={ref} maxWidth={maxWidth} fullWidth={fullWidth} {...props}>
      {title ? <DialogTitle>{title}</DialogTitle> : null}
      {children}
    </Dialog>
  );
});

/** Тело модального окна (компактные отступы из темы). */
export const MpDialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  function MpDialogContent(props, ref) {
    return <DialogContent ref={ref} {...props} />;
  },
);

/** Нижняя панель действий модального окна. */
export const MpDialogActions = forwardRef<HTMLDivElement, DialogActionsProps>(
  function MpDialogActions(props, ref) {
    return <DialogActions ref={ref} {...props} />;
  },
);
