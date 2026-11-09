import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MpSpinner } from './MpSpinner';

const meta = {
  title: 'Components/Spinner',
  component: MpSpinner,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    size: 32,
    label: 'Загрузка данных…',
    minHeight: 160,
  },
  argTypes: {
    size: { control: { type: 'range', min: 16, max: 64, step: 4 } },
    label: { control: 'text' },
  },
} satisfies Meta<typeof MpSpinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => <div style={{ width: 360 }}>{<MpSpinner {...args} />}</div>,
};

export const Sizes: Story = {
  render: () => (
    <Stack direction="row" spacing={3} sx={{ alignItems: 'center', px: 2 }}>
      <MpSpinner size={20} minHeight={48} />
      <MpSpinner size={32} minHeight={64} />
      <MpSpinner size={48} label="Загрузка…" minHeight={96} />
    </Stack>
  ),
};

export const WithoutLabel: Story = {
  render: () => <MpSpinner size={28} minHeight={96} />,
};
