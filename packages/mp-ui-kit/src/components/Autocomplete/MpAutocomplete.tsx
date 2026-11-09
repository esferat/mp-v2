import Autocomplete, { type AutocompleteProps } from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { forwardRef, type ForwardedRef, type ReactElement, type ReactNode, type Ref } from 'react';

export type MpAutocompleteProps<T> = Omit<
  AutocompleteProps<T, false, false, false>,
  'renderInput' | 'size'
> & {
  /** Подпись поля. */
  label?: ReactNode;
  /** Подсказка в пустом поле. */
  placeholder?: string;
  /** Текст под полем (подсказка или ошибка). */
  helperText?: ReactNode;
  /** Ошибка валидации. */
  error?: boolean;
  /** Обязательное поле. */
  required?: boolean;
  /** Размер поля. @default 'small' */
  size?: 'small' | 'medium';
  /** Во всю ширину родителя. @default true */
  fullWidth?: boolean;
};

function MpAutocompleteInner<T>(
  {
    label,
    placeholder,
    helperText,
    error,
    required,
    size = 'small',
    fullWidth = true,
    disabled,
    loading,
    ...props
  }: MpAutocompleteProps<T>,
  ref: ForwardedRef<HTMLDivElement>,
): ReactElement {
  return (
    <Autocomplete<T, false, false, false>
      ref={ref}
      fullWidth={fullWidth}
      disabled={disabled}
      loading={loading}
      {...props}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          helperText={helperText}
          error={error}
          required={required}
          size={size}
        />
      )}
    />
  );
}

/**
 * Автокомплит mp-ui-kit (поиск по списку): label, ошибка и подсказка — как у `MpTextField`.
 *
 * @example
 * <MpAutocomplete
 *   label="Специализация"
 *   options={specializations}
 *   getOptionLabel={(o) => o.title}
 *   value={value}
 *   onChange={(_, v) => setValue(v)}
 * />
 */
export const MpAutocomplete = forwardRef(MpAutocompleteInner) as <T>(
  props: MpAutocompleteProps<T> & { ref?: Ref<HTMLDivElement> },
) => ReactElement;
