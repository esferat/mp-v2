import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MpButton } from '../Button/MpButton';
import { MpTextField } from '../TextField/MpTextField';
import { MpDialog, MpDialogActions, MpDialogContent } from './MpDialog';

const meta = {
  title: 'Components/Dialog',
  component: MpDialog,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    title: 'Новый врач',
    open: false,
    maxWidth: 'sm',
    fullWidth: true,
    fullScreen: false,
    keepMounted: false,
  },
  argTypes: {
    open: { control: false },
    onClose: { control: false },
    children: { control: false },
    title: { control: 'text' },
    maxWidth: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl', false] },
  },
} satisfies Meta<typeof MpDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <MpButton variant="contained" onClick={() => setOpen(true)}>
          Открыть окно
        </MpButton>
        <MpDialog {...args} open={open} onClose={() => setOpen(false)}>
          <MpDialogContent>
            <Stack spacing={2}>
              <MpTextField label="ФИО" placeholder="Иванова Мария Сергеевна" required />
              <MpTextField label="Специализация" placeholder="Хирург" />
            </Stack>
          </MpDialogContent>
          <MpDialogActions>
            <MpButton color="neutral" onClick={() => setOpen(false)}>
              Отмена
            </MpButton>
            <MpButton variant="contained" onClick={() => setOpen(false)}>
              Сохранить
            </MpButton>
          </MpDialogActions>
        </MpDialog>
      </>
    );
  },
};

export const Confirm: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <MpButton color="error" variant="outlined" onClick={() => setOpen(true)}>
          Удалить врача
        </MpButton>
        <MpDialog open={open} onClose={() => setOpen(false)} title="Удалить врача?">
          <MpDialogContent>
            Врач Иванова М. С. и все её расписания будут удалены безвозвратно.
          </MpDialogContent>
          <MpDialogActions>
            <MpButton color="neutral" onClick={() => setOpen(false)}>
              Отмена
            </MpButton>
            <MpButton color="error" variant="contained" onClick={() => setOpen(false)}>
              Удалить
            </MpButton>
          </MpDialogActions>
        </MpDialog>
      </>
    );
  },
};

export const WithoutTitle: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <MpButton variant="outlined" onClick={() => setOpen(true)}>
          Подсказка без заголовка
        </MpButton>
        <MpDialog open={open} onClose={() => setOpen(false)}>
          <MpDialogContent>
            Выберите период для отчёта — данные обновятся автоматически.
          </MpDialogContent>
          <MpDialogActions>
            <MpButton variant="contained" onClick={() => setOpen(false)}>
              Понятно
            </MpButton>
          </MpDialogActions>
        </MpDialog>
      </>
    );
  },
};
