import Alert, { type AlertProps } from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import { forwardRef, type ReactNode } from 'react';

export interface MpAlertProps extends Omit<AlertProps, 'title'> {
  /** Заголовок сообщения (внутри блока). */
  title?: ReactNode;
}

/**
 * Блок-уведомление mp-ui-kit.
 *
 * Скруглённая обводка 8px, полужирный заголовок, выравнивание по верху.
 *
 * @example
 * <MpAlert title="Готово" severity="success">Данные сохранены.</MpAlert>
 */
export const MpAlert = forwardRef<HTMLDivElement, MpAlertProps>(function MpAlert(
  { title, severity = 'info', variant = 'outlined', children, ...props },
  ref,
) {
  return (
    <Alert ref={ref} severity={severity} variant={variant} {...props}>
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {children}
    </Alert>
  );
});
