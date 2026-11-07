'use client';

import { FormControl, FormHelperText, InputLabel, TextField } from '@mui/material';

/**
 * Инпут с label и ошибкой (2.2): единая валидационная обвязка форм —
 * ошибка видна и доступна скринридеру (aria-describedby у TextField).
 */
export function FormField({
  label,
  name,
  value,
  onChange,
  error,
  helperText,
  type = 'text',
  required,
  multiline,
  rows,
  disabled,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  helperText?: string;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  placeholder?: string;
}): React.JSX.Element {
  return (
    <FormControl fullWidth error={error}>
      <InputLabel shrink htmlFor={`field-${name}`}>
        {label}
      </InputLabel>
      <TextField
        id={`field-${name}`}
        name={name}
        label={label}
        value={value}
        type={type}
        required={required}
        multiline={multiline}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        error={error}
        helperText={helperText}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && !helperText ? <FormHelperText>Ошибка заполнения</FormHelperText> : null}
    </FormControl>
  );
}
