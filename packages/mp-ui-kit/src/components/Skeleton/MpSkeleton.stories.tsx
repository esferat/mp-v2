import { Card, CardContent, Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MpSkeleton } from './MpSkeleton';

const meta = {
  title: 'Components/Skeleton',
  component: MpSkeleton,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    variant: 'text',
    lines: undefined,
    rows: undefined,
    animation: 'pulse',
    width: undefined,
    height: undefined,
  },
  argTypes: {
    variant: { control: 'select', options: ['text', 'circular', 'rectangular', 'rounded'] },
    animation: { control: 'select', options: ['pulse', 'wave', false] },
    lines: { control: { type: 'range', min: 1, max: 10, step: 1 } },
    rows: { control: { type: 'range', min: 1, max: 12, step: 1 } },
    width: { control: 'text' },
    height: { control: 'text' },
  },
} satisfies Meta<typeof MpSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Lines: Story = {
  render: () => (
    <Stack spacing={2} sx={{ width: 320 }}>
      <MpSkeleton lines={3} />
      <MpSkeleton lines={6} />
    </Stack>
  ),
};

export const Variants: Story = {
  render: () => (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
      <MpSkeleton variant="circular" width={40} height={40} />
      <MpSkeleton variant="rectangular" width={120} height={64} />
      <MpSkeleton variant="rounded" width={120} height={64} />
    </Stack>
  ),
};

export const TableRows: Story = {
  render: () => (
    <Card sx={{ width: 480 }}>
      <CardContent>
        {/* Макеты: «таблица — 10 строк» вместо спиннера-центра. */}
        <MpSkeleton rows={10} height={32} />
      </CardContent>
    </Card>
  ),
};

export const CardPlaceholder: Story = {
  render: () => (
    <Card sx={{ width: 320 }}>
      <CardContent>
        <MpSkeleton lines={6} />
      </CardContent>
    </Card>
  ),
};
