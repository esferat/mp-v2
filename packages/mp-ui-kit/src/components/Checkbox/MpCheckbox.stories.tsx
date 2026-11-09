import { Stack } from '@mui/material';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MpCheckbox } from './MpCheckbox';

const meta = {
  title: 'Components/Checkbox',
  component: MpCheckbox,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    label: 'Согласен',
    checked: false,
    disabled: false,
  },
  argTypes: {
    label: { control: 'text' },
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof MpCheckbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithoutLabel: Story = {
  args: { label: undefined },
};

const DAYS = [
  [1, 'Пн'],
  [2, 'Вт'],
  [3, 'Ср'],
  [4, 'Чт'],
  [5, 'Пт'],
  [6, 'Сб'],
  [7, 'Вс'],
] as const;

export const WorkDaysGroup: Story = {
  render: function WorkDays() {
    const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
    return (
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {DAYS.map(([value, label]) => (
          <MpCheckbox
            key={value}
            label={label}
            checked={days.includes(value)}
            onChange={(event) =>
              setDays((prev) =>
                event.target.checked ? [...prev, value] : prev.filter((day) => day !== value),
              )
            }
          />
        ))}
      </Stack>
    );
  },
};

export const Disabled: Story = {
  args: { checked: true, disabled: true },
};
