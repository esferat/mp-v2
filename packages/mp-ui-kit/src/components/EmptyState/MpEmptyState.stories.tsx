import SearchOffIcon from '@mui/icons-material/SearchOff';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MpButton } from '../Button/MpButton';
import { MpEmptyState } from './MpEmptyState';

const meta = {
  title: 'Components/EmptyState',
  component: MpEmptyState,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    title: 'Ничего не найдено',
    description: 'Измените фильтры или создайте нового врача',
    size: 'medium',
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    size: { control: 'radio', options: ['small', 'medium'] },
    icon: { control: false },
    action: { control: false },
  },
} satisfies Meta<typeof MpEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div style={{ width: 420 }}>
      <MpEmptyState {...args} icon={<SearchOffIcon />} />
    </div>
  ),
};

export const WithAction: Story = {
  render: () => (
    <div style={{ width: 420 }}>
      <MpEmptyState
        icon={<SearchOffIcon />}
        title="Ничего не найдено"
        description="Ни один врач не подходит под выбранные фильтры"
        action={
          <MpButton variant="contained" onClick={() => undefined}>
            Создать врача
          </MpButton>
        }
      />
    </div>
  ),
};

/** Нет свободных окон на дату — из design/booking.md. */
export const NoSlots: Story = {
  render: () => (
    <div style={{ width: 420 }}>
      <MpEmptyState
        icon={<EventBusyIcon />}
        title="Свободных окон нет"
        description="На эту дату запись не ведётся — выберите другую"
        action={<MpButton variant="outlined">Показать ближайшие даты</MpButton>}
      />
    </div>
  ),
};

export const Small: Story = {
  render: () => (
    <Stack spacing={3} sx={{ width: 420 }}>
      <MpEmptyState
        size="small"
        title="Записей пока нет"
        description="Первая запись появится здесь"
      />
      <MpEmptyState
        size="small"
        title="Без описания"
        action={<MpButton size="small">Обновить</MpButton>}
      />
    </Stack>
  ),
};
