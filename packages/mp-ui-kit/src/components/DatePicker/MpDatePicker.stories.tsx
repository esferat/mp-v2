import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MpDateProvider } from './MpDateProvider';
import { MpDatePicker } from './MpDatePicker';
import { MpDateRangePicker } from './MpDateRangePicker';

const meta = {
  title: 'Components/DatePicker',
  component: MpDatePicker,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MpDateProvider>
        <Story />
      </MpDateProvider>
    ),
  ],
  args: {
    label: 'Дата',
    size: 'medium',
    required: false,
    disabled: false,
    error: false,
  },
  argTypes: {
    label: { control: 'text' },
    size: { control: 'radio', options: ['small', 'medium'] },
    value: { control: false },
    onChange: { control: false },
    slotProps: { control: false },
  },
} satisfies Meta<typeof MpDatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState<Date | null>(null);
    return (
      <div style={{ width: 220 }}>
        <MpDatePicker {...args} value={value} onChange={(next) => setValue(next as Date | null)} />
      </div>
    );
  },
};

export const States: Story = {
  render: () => {
    const [value, setValue] = useState<Date | null>(new Date(2026, 10, 1));
    const onChange = (next: Date | null) => setValue(next);

    return (
      <Stack spacing={2} sx={{ width: 220 }}>
        <MpDatePicker label="Пустое" value={null} onChange={onChange} />
        <MpDatePicker label="Выбрано" value={value} onChange={onChange} />
        <MpDatePicker
          label="С ошибкой"
          value={null}
          onChange={onChange}
          error
          helperText="Укажите дату приёма"
        />
        <MpDatePicker label="Заблокировано" value={value} onChange={onChange} disabled />
        <MpDatePicker label="Малый размер" value={value} onChange={onChange} size="small" />
      </Stack>
    );
  },
};

export const Range: Story = {
  render: () => {
    const [startDate, setStartDate] = useState<Date | null>(new Date(2026, 10, 1));
    const [endDate, setEndDate] = useState<Date | null>(new Date(2026, 10, 30));

    return (
      <div style={{ width: 400 }}>
        <MpDateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
      </div>
    );
  },
};

export const RangeWithError: Story = {
  render: () => {
    const [startDate, setStartDate] = useState<Date | null>(new Date(2026, 10, 15));
    const [endDate, setEndDate] = useState<Date | null>(new Date(2026, 10, 1));

    return (
      <div style={{ width: 400 }}>
        <MpDateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          error={startDate !== null && endDate !== null && startDate > endDate}
          helperText="Начало периода позже окончания"
        />
      </div>
    );
  },
};
