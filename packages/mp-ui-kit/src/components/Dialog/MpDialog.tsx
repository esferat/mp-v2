import Dialog, { type DialogProps } from '@mui/material/Dialog';
import DialogActions, { type DialogActionsProps } from '@mui/material/DialogActions';
import DialogContent, { type DialogContentProps } from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Zoom from '@mui/material/Zoom';
import { forwardRef, type ReactNode } from 'react';

/** Брейкпоинт темы (по макетам: `md` = 960, `lg` = 1280). */
export type MpDialogBreakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface MpDialogProps extends Omit<DialogProps, 'title'> {
  /** Заголовок окна (при наличии рендерится `DialogTitle`). */
  title?: ReactNode;
  /**
   * Контекст под заголовком (макет visit-result.md: «Пациент: …», «Приём: …»)
   * — `body2` цвета `text.secondary`.
   */
  subtitle?: ReactNode;
  /** Разделитель под шапкой окна (включается автоматически при `subtitle`). */
  divider?: boolean;
  /** Во весь экран ниже брейкпоинта (макет visit-result.md: «< 960 — fullScreen»). */
  fullScreenBelow?: MpDialogBreakpoint;
}

/**
 * Модальное окно mp-ui-kit. Появление — Zoom (scale 0.75 → 1 + fade)
 * длительностью из темы (стандарт 0.5 с); свой слот `slots.transition`
 * в props переопределяет дефолт.
 *
 * @example
 * <MpDialog title="Новый врач" open={open} onClose={close}>
 *   <MpDialogContent>…</MpDialogContent>
 *   <MpDialogActions>…</MpDialogActions>
 * </MpDialog>
 */
export const MpDialog = forwardRef<HTMLDivElement, MpDialogProps>(function MpDialog(
  {
    title,
    subtitle,
    divider,
    fullScreenBelow,
    fullScreen,
    children,
    maxWidth = 'sm',
    fullWidth = true,
    ...props
  },
  ref,
) {
  const theme = useTheme();
  // Без `fullScreenBelow` — запрос, который никогда не срабатывает.
  const belowViewport = useMediaQuery(
    fullScreenBelow !== undefined ? theme.breakpoints.down(fullScreenBelow) : 'not all',
  );
  const withDivider = divider ?? (title !== undefined && subtitle !== undefined);

  return (
    <Dialog
      ref={ref}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      fullScreen={fullScreen ?? belowViewport}
      {...props}
      slots={{ ...props.slots, transition: props.slots?.transition ?? Zoom }}
      transitionDuration={props.transitionDuration ?? theme.transitions.duration.standard}
    >
      {title ? (
        <DialogTitle
          sx={withDivider ? { borderBottom: '1px solid', borderColor: 'divider' } : undefined}
        >
          {title}
          {subtitle ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {subtitle}
            </Typography>
          ) : null}
        </DialogTitle>
      ) : null}
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
