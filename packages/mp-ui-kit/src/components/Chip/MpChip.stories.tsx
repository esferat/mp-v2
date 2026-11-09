import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MpChip } from './MpChip';

const meta = {
  title: 'Components/Chip',
  component: MpChip,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    label: 'Метка',
    color: 'neutral',
    variant: 'filled',
    size: 'small',
    selected: false,
    disabled: false,
    onDelete: undefined,
  },
  argTypes: {
    color: {
      control: 'select',
      options: [
        'neutral',
        'default',
        'primary',
        'secondary',
        'brand',
        'error',
        'info',
        'success',
        'warning',
      ],
    },
    variant: { control: 'select', options: ['filled', 'outlined'] },
    size: { control: 'radio', options: ['small', 'medium'] },
    selected: { control: 'boolean' },
    label: { control: 'text' },
  },
} satisfies Meta<typeof MpChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Colors: Story = {
  render: () => (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      <MpChip color="neutral" label="Neutral" />
      <MpChip color="brand" label="Brand" />
      <MpChip color="primary" label="Primary" />
      <MpChip color="secondary" label="Secondary" />
      <MpChip color="success" label="Success" />
      <MpChip color="warning" label="Warning" />
      <MpChip color="error" label="Error" />
      <MpChip color="info" label="Info" />
    </Stack>
  ),
};

export const Variants: Story = {
  render: () => (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      <MpChip color="brand" label="Filled" />
      <MpChip color="brand" label="Outlined" variant="outlined" />
      <MpChip color="neutral" label="Filled" />
      <MpChip color="neutral" label="Outlined" variant="outlined" />
    </Stack>
  ),
};

export const WithDelete: Story = {
  render: () => (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      <MpChip color="brand" label="Фильтр: новый" onDelete={() => {}} />
      <MpChip color="neutral" label="Тег" onDelete={() => {}} />
    </Stack>
  ),
};

/** Слоты приёма (design/booking.md): свободные — contained, выбранный — filled primary, занятые — disabled. */
export const Slots: Story = {
  render: () => (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', maxWidth: 320 }}>
      <MpChip label="10:00" onClick={() => {}} />
      <MpChip label="10:30" onClick={() => {}} />
      <MpChip label="11:00" onClick={() => {}} />
      <MpChip label="11:30" selected onClick={() => {}} />
      <MpChip label="13:00" disabled />
      <MpChip label="13:30" disabled />
    </Stack>
  ),
};
