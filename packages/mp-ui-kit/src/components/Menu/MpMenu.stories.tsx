import { type MouseEvent, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { MpButton } from '../Button/MpButton';
import { MpMenu, MpMenuItem } from './MpMenu';

const meta = {
  title: 'Components/Menu',
  component: MpMenu,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { open: false },
} satisfies Meta<typeof MpMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Меню действий строки записи (appointments.md: «Перенести», «Отменить»). */
export const Actions: Story = {
  render: () => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = anchorEl !== null;

    const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    return (
      <Box sx={{ p: 4 }}>
        <MpButton variant="outlined" onClick={handleOpen}>
          Действия
        </MpButton>
        <MpMenu anchorEl={anchorEl} open={open} onClose={handleClose}>
          <MpMenuItem onClick={handleClose}>Перенести</MpMenuItem>
          <MpMenuItem onClick={handleClose}>Внести результат</MpMenuItem>
          <MpMenuItem disabled onClick={handleClose}>
            Отменить
          </MpMenuItem>
        </MpMenu>
      </Box>
    );
  },
};

/** С иконками и разделителем. */
export const WithIcons: Story = {
  render: () => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = anchorEl !== null;

    const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    return (
      <Box sx={{ p: 4 }}>
        <MpButton onClick={handleOpen}>Меню записи</MpButton>
        <MpMenu anchorEl={anchorEl} open={open} onClose={handleClose}>
          <MpMenuItem onClick={handleClose}>⬇ Скачать документ</MpMenuItem>
          <MpMenuItem onClick={handleClose}>✎ Редактировать</MpMenuItem>
          <MpMenuItem divider onClick={handleClose}>
            ⊕ Дублировать
          </MpMenuItem>
          <MpMenuItem onClick={handleClose} sx={{ color: 'error.main' }}>
            ✕ Отменить запись
          </MpMenuItem>
        </MpMenu>
      </Box>
    );
  },
};
