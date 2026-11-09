import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MpAvatar } from './MpAvatar';

const meta = {
  title: 'Components/Avatar',
  component: MpAvatar,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    name: 'Иван Петров',
    size: 'md',
  },
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    name: { control: 'text' },
    src: { control: 'text' },
  },
} satisfies Meta<typeof MpAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Initials: Story = {
  render: () => (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
      <MpAvatar name="Иван Петров" size="xs" />
      <MpAvatar name="Мария Смирнова" size="sm" />
      <MpAvatar name="Алексей Кузнецов" size="md" />
      <MpAvatar name="Ольга" size="lg" />
      <MpAvatar name="Пётр Сидоров" size="xl" />
    </Stack>
  ),
};

export const WithImage: Story = {
  render: () => (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
      <MpAvatar src="https://i.pravatar.cc/96?img=12" size="md" />
      <MpAvatar src="https://i.pravatar.cc/96?img=32" size="lg" />
      <MpAvatar src="https://i.pravatar.cc/96?img=5" size="xl" />
    </Stack>
  ),
};

export const Colors: Story = {
  render: () => (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
      <MpAvatar sx={{ backgroundColor: 'primary.main' }}>MP</MpAvatar>
      <MpAvatar sx={{ backgroundColor: 'secondary.main' }}>MP</MpAvatar>
      <MpAvatar sx={{ backgroundColor: 'brand.main' }}>MP</MpAvatar>
      <MpAvatar sx={{ backgroundColor: 'neutral.main' }}>MP</MpAvatar>
      <MpAvatar sx={{ backgroundColor: 'success.main' }}>MP</MpAvatar>
      <MpAvatar sx={{ backgroundColor: 'error.main' }}>MP</MpAvatar>
    </Stack>
  ),
};
