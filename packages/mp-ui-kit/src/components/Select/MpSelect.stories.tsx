import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MpSelect, type MpSelectOption } from './MpSelect';

const specializations: MpSelectOption[] = [
  { value: 'surgeon', label: 'Хирург' },
  { value: 'therapist', label: 'Терапевт' },
  { value: 'pediatrician', label: 'Педиатр' },
  { value: 'cardiologist', label: 'Кардиолог' },
  { value: 'neurologist', label: 'Невролог', disabled: true },
];

const meta = {
  title: 'Components/Select',
  component: MpSelect,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    label: 'Специализация',
    options: specializations,
    helperText: 'Выберите из списка',
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
  },
} satisfies Meta<typeof MpSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState('');
    return (
      <div style={{ width: 280 }}>
        <MpSelect
          {...args}
          value={value}
          onChange={(event) => setValue(String(event.target.value))}
        />
      </div>
    );
  },
};

export const States: Story = {
  render: () => {
    const [value, setValue] = useState('therapist');
    const onChange = (event: { target: { value: unknown } }) =>
      setValue(String(event.target.value));

    return (
      <Stack spacing={2} sx={{ width: 280 }}>
        <MpSelect
          label="По умолчанию"
          options={specializations}
          value=""
          onChange={onChange}
          placeholder="Не выбрано"
        />
        <MpSelect label="Выбрано" options={specializations} value={value} onChange={onChange} />
        <MpSelect
          label="С ошибкой"
          options={specializations}
          value=""
          onChange={onChange}
          error
          helperText="Укажите специализацию"
        />
        <MpSelect
          label="Заблокировано"
          options={specializations}
          value="surgeon"
          onChange={onChange}
          disabled
        />
        <MpSelect
          label="Малый размер"
          options={specializations}
          value="surgeon"
          onChange={onChange}
          size="small"
        />
      </Stack>
    );
  },
};
