import { Stack, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MpButton } from '../Button/MpButton';
import { MpCard, MpCardActions, MpCardContent } from './MpCard';

const meta = {
  title: 'Components/Card',
  component: MpCard,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    variant: 'elevated',
    children: undefined,
  },
  argTypes: {
    variant: { control: 'select', options: ['elevated', 'outlined', 'flat'] },
    children: { control: false },
  },
} satisfies Meta<typeof MpCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const cardBody = (
  <>
    <MpCardContent>
      <Typography variant="h6" gutterBottom>
        Заголовок карточки
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Карточка использует токены темы: скругление 12px, граница и мягкая тень.
      </Typography>
    </MpCardContent>
    <MpCardActions>
      <MpButton variant="contained">Действие</MpButton>
      <MpButton variant="text">Отмена</MpButton>
    </MpCardActions>
  </>
);

export const Playground: Story = {
  render: (args) => (
    <MpCard {...args} sx={{ width: 360 }}>
      {cardBody}
    </MpCard>
  ),
};

export const Variants: Story = {
  render: (args) => (
    <Stack direction="row" spacing={2}>
      <MpCard {...args} variant="elevated" sx={{ width: 300 }}>
        {cardBody}
      </MpCard>
      <MpCard {...args} variant="outlined" sx={{ width: 300 }}>
        {cardBody}
      </MpCard>
      <MpCard {...args} variant="flat" sx={{ width: 300 }}>
        {cardBody}
      </MpCard>
    </Stack>
  ),
};

export const ContentPadding: Story = {
  render: (args) => (
    <Stack direction="row" spacing={2}>
      <MpCard {...args} sx={{ width: 300 }}>
        <MpCardContent padding="sm">
          <Typography variant="body2">padding=&quot;sm&quot; (12px)</Typography>
        </MpCardContent>
      </MpCard>
      <MpCard {...args} sx={{ width: 300 }}>
        <MpCardContent padding="md">
          <Typography variant="body2">padding=&quot;md&quot; (16px)</Typography>
        </MpCardContent>
      </MpCard>
      <MpCard {...args} sx={{ width: 300 }}>
        <MpCardContent padding="lg">
          <Typography variant="body2">padding=&quot;lg&quot; (24px)</Typography>
        </MpCardContent>
      </MpCard>
    </Stack>
  ),
};
