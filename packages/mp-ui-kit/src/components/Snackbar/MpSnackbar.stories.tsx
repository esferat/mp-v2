import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MpButton } from '../Button/MpButton';
import { MpSnackbar } from './MpSnackbar';

const meta = {
  title: 'Components/Snackbar',
  component: MpSnackbar,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    message: 'Сохранено',
    severity: 'success',
    autoHideDuration: 6000,
    anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
  },
  argTypes: {
    open: { control: false },
    onClose: { control: false },
    message: { control: 'text' },
    severity: { control: 'select', options: ['success', 'info', 'warning', 'error', undefined] },
    anchorOrigin: {
      control: 'select',
      options: ['bottom center', 'bottom left', 'top center', 'top right'],
      mapping: {
        'bottom center': { vertical: 'bottom', horizontal: 'center' },
        'bottom left': { vertical: 'bottom', horizontal: 'left' },
        'top center': { vertical: 'top', horizontal: 'center' },
        'top right': { vertical: 'top', horizontal: 'right' },
      },
    },
  },
} satisfies Meta<typeof MpSnackbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <MpButton variant="contained" onClick={() => setOpen(true)}>
          Показать тост
        </MpButton>
        <MpSnackbar {...args} open={open} onClose={() => setOpen(false)} />
      </>
    );
  },
};

export const Severities: Story = {
  render: () => {
    const [open, setOpen] = useState<'success' | 'info' | 'warning' | 'error' | null>(null);

    return (
      <Stack direction="row" spacing={1}>
        <MpButton variant="outlined" onClick={() => setOpen('success')}>
          Успех
        </MpButton>
        <MpButton variant="outlined" onClick={() => setOpen('info')}>
          Инфо
        </MpButton>
        <MpButton variant="outlined" onClick={() => setOpen('warning')}>
          Предупреждение
        </MpButton>
        <MpButton variant="outlined" color="error" onClick={() => setOpen('error')}>
          Ошибка
        </MpButton>
        <MpSnackbar
          open={open !== null}
          severity={open ?? 'info'}
          message={
            open === 'error'
              ? 'Не удалось загрузить данные (requestId: 8f3a-41c2)'
              : open === 'warning'
                ? 'Запись уже обработана другим пользователем'
                : open === 'info'
                  ? 'Фильтры применены'
                  : 'Запись принята'
          }
          onClose={() => setOpen(null)}
        />
      </Stack>
    );
  },
};

export const WithAction: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <MpButton variant="contained" onClick={() => setOpen(true)}>
          Тост с действием
        </MpButton>
        <MpSnackbar
          open={open}
          severity="error"
          message="Сеть недоступна. Повторить запрос?"
          onClose={() => setOpen(false)}
          action={
            <MpButton
              size="small"
              color="inherit"
              variant="outlined"
              onClick={() => setOpen(false)}
            >
              Повторить
            </MpButton>
          }
        />
      </>
    );
  },
};

export const Plain: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <MpButton variant="outlined" onClick={() => setOpen(true)}>
          Простой тост (без Alert)
        </MpButton>
        <MpSnackbar
          open={open}
          message="Черновик сохранён автоматически"
          onClose={() => setOpen(false)}
        />
      </>
    );
  },
};
