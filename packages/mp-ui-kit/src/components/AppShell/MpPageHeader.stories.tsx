import AddIcon from '@mui/icons-material/Add';
import { Breadcrumbs, Link, Stack, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MpButton } from '../Button/MpButton';
import { MpPageHeader } from './MpPageHeader';

const meta = {
  title: 'Shell/PageHeader',
  component: MpPageHeader,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: {
    title: 'Управление записями',
    subtitle: '01.11.2026 — 30.11.2026',
  },
  argTypes: {
    actions: { control: false },
    breadcrumbs: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof MpPageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Список (design/doctors-list.md): заголовок + «+ Новый врач». */
export const WithAction: Story = {
  args: {
    title: 'Врачи',
    subtitle: undefined,
    actions: (
      <MpButton variant="contained" startIcon={<AddIcon />}>
        Новый врач
      </MpButton>
    ),
  },
};

/** Карточка (design/doctor-form.md): «‹ Врачи / Иванов Иван Иванов» + действия. */
export const WithBackAndBreadcrumbs: Story = {
  args: {
    title: 'Иванов Иван Иванов',
    subtitle: undefined,
    onBack: () => undefined,
    backLabel: 'Врачи',
    breadcrumbs: (
      <Breadcrumbs aria-label="Хлебные крошки">
        <Link href="#" underline="hover" color="inherit" variant="body2">
          Врачи
        </Link>
        <Typography variant="body2">Иванов Иван Иванов</Typography>
      </Breadcrumbs>
    ),
    actions: (
      <Stack direction="row" spacing={1}>
        <MpButton variant="outlined">Архивировать</MpButton>
        <MpButton variant="contained">Сохранить</MpButton>
      </Stack>
    ),
  },
};

/** Профиль (design/profile.md): «← Назад  Профиль  [Выйти]». */
export const WithBack: Story = {
  args: {
    title: 'Профиль',
    subtitle: 'Иванов Иван Иванович',
    onBack: () => undefined,
    actions: <MpButton variant="outlined">Выйти</MpButton>,
  },
};
