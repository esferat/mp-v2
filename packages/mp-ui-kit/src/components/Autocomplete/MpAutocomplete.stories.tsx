import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MpAutocomplete } from './MpAutocomplete';

interface Doctor {
  id: number;
  name: string;
}

const doctors: Doctor[] = [
  { id: 1, name: 'Иванова Мария Сергеевна' },
  { id: 2, name: 'Петров Алексей Владимирович' },
  { id: 3, name: 'Сидорова Елена Андреевна' },
  { id: 4, name: 'Кузнецов Дмитрий Игоревич' },
  { id: 5, name: 'Смирнова Ольга Павловна' },
];

const meta = {
  title: 'Components/Autocomplete',
  component: MpAutocomplete<Doctor>,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    label: 'Врач',
    options: doctors,
    getOptionLabel: (option: Doctor) => option.name,
    placeholder: 'Начните вводить фамилию…',
    helperText: 'Поиск по списку врачей',
    size: 'medium',
    fullWidth: false,
    required: false,
    disabled: false,
    error: false,
  },
  argTypes: {
    size: { control: 'radio', options: ['small', 'medium'] },
    value: { control: false },
    onChange: { control: false },
    options: { control: false },
    getOptionLabel: { control: false },
  },
} satisfies Meta<typeof MpAutocomplete<Doctor>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState<Doctor | null>(null);
    return (
      <div style={{ width: 320 }}>
        <MpAutocomplete<Doctor> {...args} value={value} onChange={(_, next) => setValue(next)} />
      </div>
    );
  },
};

export const States: Story = {
  render: () => {
    const [value, setValue] = useState<Doctor | null>(doctors[0]);

    return (
      <Stack spacing={2} sx={{ width: 320 }}>
        <MpAutocomplete<Doctor>
          label="Выбрано"
          options={doctors}
          getOptionLabel={(o) => o.name}
          value={value}
          onChange={(_, v) => setValue(v)}
        />
        <MpAutocomplete<Doctor>
          label="С ошибкой"
          options={doctors}
          getOptionLabel={(o) => o.name}
          value={null}
          onChange={() => undefined}
          error
          helperText="Врач не выбран"
        />
        <MpAutocomplete<Doctor>
          label="Загрузка"
          options={[]}
          getOptionLabel={(o: Doctor) => o.name}
          value={null}
          onChange={() => undefined}
          loading
          open
        />
        <MpAutocomplete<Doctor>
          label="Заблокировано"
          options={doctors}
          getOptionLabel={(o) => o.name}
          value={null}
          onChange={() => undefined}
          disabled
        />
      </Stack>
    );
  },
};

export const WithClear: Story = {
  render: () => {
    const [value, setValue] = useState<Doctor | null>(doctors[2]);
    return (
      <div style={{ width: 320 }}>
        <MpAutocomplete
          label="Врач (с очисткой)"
          options={doctors}
          getOptionLabel={(o) => o.name}
          value={value}
          onChange={(_, v) => setValue(v)}
          clearOnEscape
          disableClearable={false}
        />
      </div>
    );
  },
};
