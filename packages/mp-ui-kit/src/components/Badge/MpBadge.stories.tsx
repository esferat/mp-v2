import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MpButton } from '../Button/MpButton';
import { MpBadge } from './MpBadge';

const meta = {
  title: 'Components/Badge',
  component: MpBadge,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    badgeContent: 12,
    max: 99,
    color: 'primary',
    variant: 'standard',
    showZero: false,
    invisible: false,
  },
  argTypes: {
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'error', 'info', 'success', 'warning', 'neutral'],
    },
    variant: { control: 'select', options: ['standard', 'dot'] },
    badgeContent: { control: 'object' },
  },
} satisfies Meta<typeof MpBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

const InboxButton = () => <MpButton variant="outlined">Сообщения</MpButton>;

export const Playground: Story = {
  render: (args) => (
    <MpBadge {...args}>
      <InboxButton />
    </MpBadge>
  ),
};

export const Colors: Story = {
  render: (args) => (
    <Stack direction="row" spacing={3}>
      <MpBadge {...args} color="primary">
        <InboxButton />
      </MpBadge>
      <MpBadge {...args} color="neutral">
        <InboxButton />
      </MpBadge>
      <MpBadge {...args} color="error">
        <InboxButton />
      </MpBadge>
      <MpBadge {...args} color="success">
        <InboxButton />
      </MpBadge>
    </Stack>
  ),
};

export const Dot: Story = {
  render: (args) => (
    <Stack direction="row" spacing={3}>
      <MpBadge {...args} variant="dot" badgeContent={1}>
        <InboxButton />
      </MpBadge>
      <MpBadge {...args} variant="dot" badgeContent={1} color="error">
        <InboxButton />
      </MpBadge>
    </Stack>
  ),
};

export const MaxValue: Story = {
  render: (args) => (
    <Stack direction="row" spacing={3}>
      <MpBadge {...args} badgeContent={9}>
        <InboxButton />
      </MpBadge>
      <MpBadge {...args} badgeContent={120}>
        <InboxButton />
      </MpBadge>
      <MpBadge {...args} badgeContent={120} max={999}>
        <InboxButton />
      </MpBadge>
    </Stack>
  ),
};
