import Checkbox, { type CheckboxProps } from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { forwardRef, type ReactNode } from 'react';

export type MpCheckboxProps = CheckboxProps & {
  /** Подпись рядом с флажком (дни недели, согласие и т.п.). */
  label?: ReactNode;
};

/**
 * Флажок mp-ui-kit: чекбокс сам по себе или в паре с подписью.
 *
 * @example
 * <MpCheckbox label="Пн" checked={checked} onChange={onChange} />
 */
export const MpCheckbox = forwardRef<HTMLButtonElement, MpCheckboxProps>(function MpCheckbox(
  { label, ...props },
  ref,
) {
  if (label === undefined) {
    return <Checkbox ref={ref} {...props} />;
  }
  return <FormControlLabel control={<Checkbox ref={ref} {...props} />} label={label} />;
});
