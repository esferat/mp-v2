import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MpTextField } from './MpTextField';

const meta = {
  title: 'Components/TextField',
  component: MpTextField,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    label: 'Электронная почта',
    placeholder: 'user@example.com',
    helperText: 'Мы не передаём адрес третьим лицам',
    size: 'medium',
    variant: 'outlined',
    fullWidth: false,
    required: false,
    disabled: false,
    error: false,
  },
  argTypes: {
    variant: { control: 'select', options: ['outlined', 'filled', 'standard'] },
    size: { control: 'radio', options: ['small', 'medium'] },
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'error', 'info', 'success', 'warning'],
    },
    children: { control: false },
  },
} satisfies Meta<typeof MpTextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
  render: () => (
    <Stack spacing={2} sx={{ width: 360 }}>
      <MpTextField label="По умолчанию" placeholder="Введите значение" />
      <MpTextField
        label="С подсказкой"
        helperText="Подсказка под полем"
        placeholder="Введите значение"
      />
      <MpTextField
        label="Ошибка"
        error
        helperText="Некорректный формат"
        placeholder="Введите значение"
      />
      <MpTextField label="Заблокировано" disabled placeholder="Недоступно" />
      <MpTextField label="Заполнено" defaultValue="mp-ui-kit@example.com" />
    </Stack>
  ),
};

export const WithAdornments: Story = {
  render: () => (
    <Stack spacing={2} sx={{ width: 360 }}>
      <MpTextField label="Поиск" placeholder="Найти компонент…" startAdornment={<span>🔍</span>} />
      <MpTextField label="Сумма" placeholder="0" endAdornment={<span>₽</span>} />
      <MpTextField label="С паролем" type="password" defaultValue="secret" revealable />
    </Stack>
  ),
};

/** Пароль с показом/скрытием (макет design/auth-login.md). */
export const Password: Story = {
  render: () => (
    <Stack spacing={2} sx={{ width: 360 }}>
      <MpTextField
        label="Пароль"
        type="password"
        revealable
        placeholder="Не менее 8 символов"
        helperText="Минимум 8 символов, обязательно цифра"
      />
    </Stack>
  ),
};

/** Поиск со сбросом (макет design/doctors-list.md: «🔍 Поиск по ФИО…» + IconButton сброса). */
export const Search: Story = {
  render: () => {
    const [value, setValue] = useState('Иванов');
    return (
      <MpTextField
        label="Поиск по ФИО"
        placeholder="Поиск по ФИО…"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onClear={() => setValue('')}
        clearable
        startAdornment={<span>🔍</span>}
        sx={{ width: 360 }}
      />
    );
  },
};

/** Счётчик символов (макет design/visit-result.md: «118 / 4000»). */
export const WithCounter: Story = {
  render: () => (
    <MpTextField
      label="Заключение"
      multiline
      minRows={4}
      required
      showCount
      maxLength={4000}
      defaultValue="Острый аппендицит. Выполнена аппендэктомия лапароскопически."
      sx={{ width: 480 }}
    />
  ),
};
