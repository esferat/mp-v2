import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MpUserMenu } from './MpUserMenu';

const meta = {
  title: 'Shell/UserMenu',
  component: MpUserMenu,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    name: 'Иванов Иван Иванович',
    subtitle: 'Пациент (USER)',
  },
  argTypes: {
    items: { control: false },
    avatar: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof MpUserMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: {
    items: [
      { id: 'profile', label: 'Профиль', icon: <AccountCircleIcon fontSize="small" /> },
      { id: 'logout', label: 'Выйти', icon: <LogoutIcon fontSize="small" /> },
    ],
  },
};

/** Шапка (design/layout.md): «[уведомления] [ФИО ▾] [Выйти]». */
export const InHeader: Story = {
  render: () => (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', bgcolor: 'background.paper', p: 1, borderRadius: 2 }}
    >
      <MpUserMenu
        name="Иванов Иван Иванович"
        subtitle="Администратор"
        items={[
          { id: 'profile', label: 'Профиль', icon: <AccountCircleIcon fontSize="small" /> },
          { id: 'logout', label: 'Выйти', icon: <LogoutIcon fontSize="small" /> },
        ]}
      />
    </Stack>
  ),
};
