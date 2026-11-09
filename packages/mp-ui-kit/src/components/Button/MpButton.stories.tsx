import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MpButton } from './MpButton';

const meta = {
  title: 'Components/Button',
  component: MpButton,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    children: 'Кнопка',
    variant: 'contained',
    color: 'primary',
    size: 'medium',
    loading: false,
    disabled: false,
  },
  argTypes: {
    variant: { control: 'select', options: ['contained', 'outlined', 'text'] },
    color: {
      control: 'select',
      options: [
        'primary',
        'secondary',
        'neutral',
        'error',
        'info',
        'success',
        'warning',
        'inherit',
      ],
    },
    size: { control: 'radio', options: ['small', 'medium', 'large'] },
    loadingPosition: { control: 'radio', options: ['center', 'start', 'end'] },
    children: { control: 'text' },
  },
} satisfies Meta<typeof MpButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <Stack direction="row" spacing={1.5}>
      <MpButton variant="contained">Contained</MpButton>
      <MpButton variant="outlined">Outlined</MpButton>
      <MpButton variant="text">Text</MpButton>
    </Stack>
  ),
};

export const Colors: Story = {
  render: () => (
    <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
      <MpButton variant="contained">Primary</MpButton>
      <MpButton variant="contained" color="secondary">
        Secondary
      </MpButton>
      <MpButton variant="contained" color="neutral">
        Neutral
      </MpButton>
      <MpButton variant="contained" color="error">
        Error
      </MpButton>
      <MpButton variant="contained" color="success">
        Success
      </MpButton>
      <MpButton variant="contained" color="warning">
        Warning
      </MpButton>
      <MpButton variant="contained" color="info">
        Info
      </MpButton>
    </Stack>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
      <MpButton size="small">Small</MpButton>
      <MpButton size="medium">Medium</MpButton>
      <MpButton size="large">Large</MpButton>
    </Stack>
  ),
};

export const Loading: Story = {
  render: () => (
    <Stack direction="row" spacing={1.5}>
      <MpButton loading loadingPosition="center">
        Сохранить
      </MpButton>
      <MpButton loading loadingPosition="start" variant="outlined">
        Сохранить
      </MpButton>
      <MpButton loading loadingPosition="end" variant="text">
        Сохранить
      </MpButton>
    </Stack>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Stack direction="row" spacing={1.5}>
      <MpButton disabled>Contained</MpButton>
      <MpButton disabled variant="outlined">
        Outlined
      </MpButton>
      <MpButton disabled variant="text">
        Text
      </MpButton>
    </Stack>
  ),
};
