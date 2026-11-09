import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MpButton } from '../Button/MpButton';
import { MpAlert } from './MpAlert';

const meta = {
  title: 'Components/Alert',
  component: MpAlert,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: {
    title: 'Заголовок',
    children: 'Описание сообщения. Здесь можно рассказать о событии подробнее.',
    severity: 'info',
    variant: 'outlined',
    onClose: undefined,
  },
  argTypes: {
    severity: { control: 'select', options: ['success', 'info', 'warning', 'error'] },
    variant: { control: 'select', options: ['standard', 'outlined', 'filled'] },
    title: { control: 'text' },
  },
} satisfies Meta<typeof MpAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Severities: Story = {
  render: () => (
    <Stack spacing={1.5} sx={{ maxWidth: 640 }}>
      <MpAlert severity="success" title="Успех">
        Данные успешно сохранены.
      </MpAlert>
      <MpAlert severity="info" title="Информация">
        Доступны обновления компонентов.
      </MpAlert>
      <MpAlert severity="warning" title="Внимание">
        Диск заканчивается: свободно 5%.
      </MpAlert>
      <MpAlert severity="error" title="Ошибка">
        Не удалось подключиться к серверу.
      </MpAlert>
    </Stack>
  ),
};

export const Variants: Story = {
  render: () => (
    <Stack spacing={1.5} sx={{ maxWidth: 640 }}>
      <MpAlert severity="info" variant="standard">
        Standard — мягкий фон без границы.
      </MpAlert>
      <MpAlert severity="info" variant="outlined">
        Outlined — граница (по умолчанию в mp-ui-kit).
      </MpAlert>
      <MpAlert severity="info" variant="filled">
        Filled — плотный фон.
      </MpAlert>
    </Stack>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Stack spacing={1.5} sx={{ maxWidth: 640 }}>
      <MpAlert
        severity="warning"
        title="Несохранённые изменения"
        action={
          <MpButton size="small" variant="outlined" color="neutral">
            Отменить
          </MpButton>
        }
      >
        Вы изменили настройки темы.
      </MpAlert>
    </Stack>
  ),
};
