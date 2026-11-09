import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
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
      <MpTextField
        label="С паролем"
        type="password"
        defaultValue="secret"
        endAdornment={<span>👁</span>}
      />
    </Stack>
  ),
};
