import Autocomplete, { type AutocompleteProps } from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { type ForwardedRef, forwardRef, type ReactElement, type ReactNode, type Ref } from 'react';

export type MpAutocompleteProps<
  T,
  Multiple extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
  DisableClearable extends boolean | undefined = false,
> = Omit<AutocompleteProps<T, Multiple, FreeSolo, DisableClearable>, 'renderInput' | 'size'> & {
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

/**
 * Максимум видимых опций в выпадающем списке (10 × 40px): длинный список
 * прокручивается, «Врач» в управлении записями — поиск + мультиселект.
 */
export const MP_AUTOCOMPLETE_MAX_OPTIONS = 10;

/** Стили листбокса: ровно 10 опций по 40px, дальше скролл (padding 0 — иначе «хвост» опции виден). */
const listboxSx = {
  maxHeight: MP_AUTOCOMPLETE_MAX_OPTIONS * 40,
  padding: 0,
  '& li': { height: 40, boxSizing: 'border-box' as const },
};

function MpAutocompleteInner<
  T,
  Multiple extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
  DisableClearable extends boolean | undefined = false,
>(
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
    sx,
    slotProps,
    ...props
  }: MpAutocompleteProps<T, Multiple, FreeSolo, DisableClearable>,
  ref: ForwardedRef<HTMLDivElement>,
): ReactElement {
  /**
   * Листбокс рендерится в ПОРТАЛЕ (Popper) — стили через `& .class` от корня
   * не работают, поэтому шлём их в slotProps.listbox. Строки вызывающего
   * объединяются (sx-массив: дефолты первыми, выигрывает последний).
   */
  const callerListbox = slotProps?.listbox;
  const listboxSlotProps =
    typeof callerListbox === 'function'
      ? callerListbox
      : {
          ...((callerListbox ?? {}) as Record<string, unknown>),
          sx: [
            listboxSx,
            ...(((callerListbox as { sx?: unknown } | undefined)?.sx
              ? [(callerListbox as { sx?: unknown }).sx]
              : []) as never[]),
          ],
        };

  return (
    <Autocomplete<T, Multiple, FreeSolo, DisableClearable>
      ref={ref}
      fullWidth={fullWidth}
      disabled={disabled}
      loading={loading}
      {...props}
      slotProps={
        {
          ...slotProps,
          listbox: listboxSlotProps,
        } as AutocompleteProps<T, Multiple, FreeSolo, DisableClearable>['slotProps']
      }
      sx={sx}
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
 * Автокомплит mp-ui-kit (поиск по списку): label, ошибка и подсказка — как у
 * `MpTextField`. Поддерживает `multiple` (мультиселект с чипами); в списке
 * видно максимум 10 опций (`MP_AUTOCOMPLETE_MAX_OPTIONS`), дальше скролл.
 *
 * @example
 * <MpAutocomplete
 *   label="Специализация"
 *   options={specializations}
 *   getOptionLabel={(o) => o.title}
 *   value={value}
 *   onChange={(_, v) => setValue(v)}
 * />
 *
 * @example
 * // Поиск + мультиселект (выбор врачей)
 * <MpAutocomplete
 *   label="Врач"
 *   multiple
 *   disableCloseOnSelect
 *   options={doctors}
 *   getOptionLabel={(o) => o.name}
 *   value={selected}
 *   onChange={(_, v) => setSelected(v)}
 * />
 */
export const MpAutocomplete = forwardRef(MpAutocompleteInner) as unknown as <
  T,
  Multiple extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
  DisableClearable extends boolean | undefined = false,
>(
  props: MpAutocompleteProps<T, Multiple, FreeSolo, DisableClearable> & {
    ref?: Ref<HTMLDivElement>;
  },
) => ReactElement;
