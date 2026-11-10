import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectProps } from '@mui/material/Select';
import {
  type ForwardedRef,
  forwardRef,
  type ReactElement,
  type ReactNode,
  type Ref,
  useId,
} from 'react';

export interface MpSelectOption<T extends string | number = string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export type MpSelectProps<T extends string | number = string> = Omit<
  SelectProps<T>,
  'children' | 'label'
> & {
  /** Подпись поля. */
  label?: ReactNode;
  /** Опции списка. */
  options: ReadonlyArray<MpSelectOption<T>>;
  /** Текст под полем (подсказка или ошибка). */
  helperText?: ReactNode;
  /** Пустая первая опция, например «Не выбрано». */
  placeholder?: string;
  /** Размер поля. @default 'small' */
  size?: 'small' | 'medium';
  /** Во всю ширину родителя. @default true */
  fullWidth?: boolean;
};

function MpSelectInner<T extends string | number>(
  {
    label,
    options,
    helperText,
    placeholder,
    size = 'small',
    fullWidth = true,
    error,
    required,
    disabled,
    id,
    ...selectProps
  }: MpSelectProps<T>,
  ref: ForwardedRef<HTMLDivElement>,
): ReactElement {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const labelId = `${inputId}-label`;

  return (
    <FormControl
      ref={ref}
      fullWidth={fullWidth}
      error={error}
      required={required}
      disabled={disabled}
      size={size}
    >
      {label ? (
        <InputLabel
          id={labelId}
          htmlFor={inputId}
          shrink={placeholder !== undefined ? true : undefined}
        >
          {label}
        </InputLabel>
      ) : null}
      <Select<T>
        id={inputId}
        labelId={labelId}
        label={label}
        error={error}
        disabled={disabled}
        displayEmpty={placeholder !== undefined}
        {...selectProps}
      >
        {placeholder !== undefined ? (
          <MenuItem value="">
            <em>{placeholder}</em>
          </MenuItem>
        ) : null}
        {options.map((option) => (
          <MenuItem key={String(option.value)} value={option.value} disabled={option.disabled}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </FormControl>
  );
}

/**
 * Выпадающий список mp-ui-kit: label, ошибка, подсказка и опции — одним пропсом.
 *
 * @example
 * <MpSelect
 *   label="Специализация"
 *   options={[{ value: 'surgeon', label: 'Хирург' }]}
 *   value={value}
 *   onChange={(e) => setValue(e.target.value)}
 * />
 */
export const MpSelect = forwardRef(MpSelectInner) as <T extends string | number>(
  props: MpSelectProps<T> & { ref?: Ref<HTMLDivElement> },
) => ReactElement;
