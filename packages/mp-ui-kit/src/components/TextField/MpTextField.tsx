import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import TextField, { type TextFieldProps } from '@mui/material/TextField';
import { forwardRef, useState, type ChangeEvent, type ReactNode } from 'react';

/** SVG «глаз»: не тянет `@mui/icons-material` как peer-зависимость. */
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.8" />
      {!open ? (
        <path d="M4 20L20 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

/** SVG «крестик» — сброс значения (поиск, макет doctors-list.md). */
function ClearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export type MpTextFieldProps = TextFieldProps & {
  /** Удобная обёртка над `slotProps.input.startAdornment`. */
  startAdornment?: ReactNode;
  /** Удобная обёртка над `slotProps.input.endAdornment`. */
  endAdornment?: ReactNode;
  /**
   * Показать/скрыть пароль (кнопка-глаз в конце поля) — макет auth-login.md.
   * Для `type="password"` переключает тип ввода.
   */
  revealable?: boolean;
  /** Кнопка сброса значения (поиск с очисткой — макет doctors-list.md). */
  clearable?: boolean;
  /** Вызывается по кнопке сброса (для controlled-состояния). */
  onClear?: () => void;
  /** Счётчик символов под полем «118 / 4000» — макет visit-result.md. */
  showCount?: boolean;
  /** Максимум символов (нативный `maxLength` + знаменатель счётчика). */
  maxLength?: number;
};

/**
 * Поле ввода mp-ui-kit.
 *
 * Скруглённая обводка 8px, мягкий фон, подпись поля полужирная.
 * По макетам: пароль с показом/скрытием, сброс поиска, счётчик символов.
 *
 * @example
 * <MpTextField label="Email" placeholder="user@example.com" required />
 * <MpTextField label="Пароль" type="password" revealable />
 * <MpTextField label="Заключение" multiline showCount maxLength={4000} />
 */
export const MpTextField = forwardRef<HTMLDivElement, MpTextFieldProps>(function MpTextField(
  {
    startAdornment,
    endAdornment,
    slotProps,
    revealable,
    clearable,
    onClear,
    showCount,
    maxLength,
    type,
    value,
    defaultValue,
    onChange,
    helperText,
    ...props
  },
  ref,
) {
  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] = useState(() => String(defaultValue ?? ''));
  const [revealed, setRevealed] = useState(false);

  const currentValue = isControlled ? String(value) : innerValue;

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!isControlled) setInnerValue(event.target.value);
    onChange?.(event as ChangeEvent<HTMLInputElement>);
  };

  const handleClear = () => {
    if (!isControlled) setInnerValue('');
    onClear?.();
  };

  // ——— Завершение поля: пользовательский узел + сброс + показ пароля ———
  const tail: ReactNode[] = [];
  if (endAdornment !== undefined) {
    tail.push(<Box key="end">{endAdornment}</Box>);
  }
  if (clearable && currentValue.length > 0) {
    tail.push(
      <IconButton key="clear" size="small" aria-label="Очистить" onClick={handleClear}>
        <ClearIcon />
      </IconButton>,
    );
  }
  if (revealable) {
    tail.push(
      <IconButton
        key="reveal"
        size="small"
        aria-label={revealed ? 'Скрыть пароль' : 'Показать пароль'}
        aria-pressed={revealed}
        onClick={() => setRevealed((prev) => !prev)}
      >
        <EyeIcon open={revealed} />
      </IconButton>,
    );
  }
  const composedEnd =
    tail.length === 0 ? undefined : (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{tail}</Box>
    );

  // ——— Счётчик символов: «118 / 4000» (обязательное заключение ≤ 4000) ———
  const count = currentValue.length;
  const overLimit = maxLength !== undefined && count > maxLength;
  const composedHelper = showCount ? (
    <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
      <span>{helperText}</span>
      <Box
        component="span"
        sx={{ color: overLimit ? 'error.main' : 'text.secondary', flexShrink: 0 }}
      >
        {count}
        {maxLength !== undefined ? ` / ${maxLength}` : ''}
      </Box>
    </Box>
  ) : (
    helperText
  );

  const inputSlot = {
    ...(slotProps?.input ?? {}),
    ...(startAdornment !== undefined ? { startAdornment } : {}),
    ...(composedEnd !== undefined ? { endAdornment: composedEnd } : {}),
  };
  const htmlInputSlot = {
    ...(slotProps?.htmlInput ?? {}),
    ...(maxLength !== undefined ? { maxLength } : {}),
  };

  return (
    <TextField
      ref={ref}
      type={revealable ? (revealed ? 'text' : (type ?? 'password')) : type}
      value={isControlled ? value : undefined}
      defaultValue={isControlled ? undefined : defaultValue}
      onChange={handleChange}
      helperText={composedHelper}
      slotProps={{ ...slotProps, input: inputSlot, htmlInput: htmlInputSlot }}
      {...props}
    />
  );
});
