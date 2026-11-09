import AssessmentIcon from '@mui/icons-material/Assessment';
import EventNoteIcon from '@mui/icons-material/EventNote';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import HistoryIcon from '@mui/icons-material/History';
import LogoutIcon from '@mui/icons-material/Logout';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PeopleIcon from '@mui/icons-material/People';
import PersonIcon from '@mui/icons-material/Person';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MpButton } from '../Button/MpButton';
import { MpAppShell, type MpAppShellProps } from './MpAppShell';
import type { MpNavEntry, MpNavItem } from './MpNavDrawer';
import { MpUserMenu } from './MpUserMenu';

const menu: MpNavItem[] = [
  { id: 'doctors', label: 'Врачи', icon: <MedicalServicesIcon fontSize="small" /> },
  { id: 'patients', label: 'Пациенты', icon: <PeopleIcon fontSize="small" /> },
  { id: 'schedule', label: 'Записи', icon: <EventNoteIcon fontSize="small" /> },
  { id: 'reports', label: 'Отчёты', icon: <AssessmentIcon fontSize="small" /> },
];

/** Меню по ролям (design/layout.md): секции ADMIN/USER/DOCTOR с разделителем. */
const roleMenu: MpNavEntry[] = [
  {
    id: 'admin',
    label: 'Администрирование',
    items: [
      { id: 'doctors', label: 'Врачи', icon: <MedicalServicesIcon fontSize="small" /> },
      { id: 'patients', label: 'Пациенты', icon: <PeopleIcon fontSize="small" /> },
      { id: 'schedule', label: 'Записи', icon: <EventNoteIcon fontSize="small" /> },
      { id: 'reports', label: 'Отчёты', icon: <AssessmentIcon fontSize="small" /> },
    ],
  },
  {
    id: 'doctor',
    label: 'Кабинет врача',
    items: [
      { id: 'doctor-schedule', label: 'Приёмы', icon: <EventNoteIcon fontSize="small" /> },
      {
        id: 'doctor-patients',
        label: 'Пациенты и документы',
        icon: <FolderSharedIcon fontSize="small" />,
      },
    ],
  },
  {
    id: 'patient',
    label: 'Пациент',
    items: [
      { id: 'profile', label: 'Моя карточка', icon: <PersonIcon fontSize="small" /> },
      { id: 'record', label: 'Запись', icon: <MedicalServicesIcon fontSize="small" /> },
      { id: 'history', label: 'История', icon: <HistoryIcon fontSize="small" /> },
    ],
  },
];

/** Логотип-заглушка: квадрат с символом (в проекте — `/logo.svg`). */
const logo = (
  <Box
    sx={{
      width: 32,
      height: 32,
      borderRadius: 1,
      bgcolor: 'primary.main',
      color: 'primary.contrastText',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
    }}
  >
    MP
  </Box>
);

/** Правая часть шапки (design/layout.md): [уведомления] [ФИО ▾] [Выйти]. */
const headerActions = (
  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
    <IconButton color="inherit" aria-label="Уведомления">
      <NotificationsIcon fontSize="small" />
    </IconButton>
    <MpUserMenu
      name="Иванов Иван Иванович"
      subtitle="Администратор"
      items={[
        { id: 'profile', label: 'Профиль', icon: <PersonIcon fontSize="small" /> },
        { id: 'logout', label: 'Выйти', icon: <LogoutIcon fontSize="small" /> },
      ]}
    />
    <MpButton size="small" variant="outlined" startIcon={<ExitToAppIcon fontSize="small" />}>
      Выйти
    </MpButton>
  </Stack>
);

const meta = {
  title: 'Shell/AppShell',
  component: MpAppShell,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: {
    menu,
    selectedId: 'schedule',
    logo,
    title: 'MP Admin-Panel',
    subtitle: 'Клиника «Здоровье»',
    headerActions,
    pageTitle: 'Управление записями',
    pageSubtitle: '01.11.2026 – 30.11.2026',
    children: (
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: 3,
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Здесь рендерится контент страницы (router-outlet).
        </Typography>
      </Box>
    ),
  },
  argTypes: {
    menu: { control: false },
    logo: { control: false },
    headerActions: { control: false },
    pageActions: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof MpAppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Развёрнутое меню 240px; кнопка внизу панели сворачивает его до 72px. */
export const Desktop: Story = {};

/** Меню свёрнуто по умолчанию (`defaultMini`) — только иконки + тултипы. */
export const MiniSidebar: Story = {
  args: { defaultMini: true },
};

export const WithPageActions: Story = {
  args: {
    pageActions: (
      <>
        <MpButton size="small" variant="outlined">
          Экспорт
        </MpButton>
        <MpButton size="small" variant="contained">
          Новая запись
        </MpButton>
      </>
    ),
  },
};

/** Управляемое состояние `mini` (владелец хранит флаг сам). */
export const ControlledCollapse: Story = {
  render: (args: MpAppShellProps) => {
    const [mini, setMini] = useState(false);

    return (
      <MpAppShell
        {...args}
        mini={mini}
        onMiniChange={setMini}
        pageTitle={`Управление записями (${mini ? 'свёрнуто' : 'развёрнуто'})`}
      />
    );
  },
};

/** Секции меню по ролям (design/layout.md: ADMIN / DOCTOR / USER с разделителем). */
export const RoleSections: Story = {
  args: {
    menu: roleMenu,
    selectedId: 'doctor-schedule',
    pageTitle: 'Кабинет врача — приёмы',
    pageSubtitle: undefined,
    title: 'Медицинский портал',
    subtitle: undefined,
  },
};
