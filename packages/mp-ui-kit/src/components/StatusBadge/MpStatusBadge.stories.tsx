import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { type MpStatus, MpStatusBadge, mpStatuses } from './MpStatusBadge';

const allStatuses = Object.keys(mpStatuses) as MpStatus[];

const meta = {
  title: 'Components/StatusBadge',
  component: MpStatusBadge,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    status: 'SUBMITTED',
    size: 'small',
  },
  argTypes: {
    status: { control: 'select', options: allStatuses },
    size: { control: 'radio', options: ['small', 'medium'] },
    label: { control: 'text' },
  },
} satisfies Meta<typeof MpStatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Записи (appointments.md, visual/_shared.css `.status`): точка + текст. */
export const Appointments: Story = {
  render: () => (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      <MpStatusBadge status="SUBMITTED" />
      <MpStatusBadge status="APPROVED" />
      <MpStatusBadge status="DECLINED" />
      <MpStatusBadge status="CANCELLED" />
    </Stack>
  ),
};

/** Кабинет врача (design/doctor-schedule.md): + «Приём завершён» — синий. */
export const DoctorSchedule: Story = {
  render: () => (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      <MpStatusBadge status="SUBMITTED" />
      <MpStatusBadge status="APPROVED" />
      <MpStatusBadge status="DECLINED" />
      <MpStatusBadge status="CANCELLED" />
      <MpStatusBadge status="COMPLETED" />
      <MpStatusBadge status="COMPLETED" label="✓ Есть" />
    </Stack>
  ),
};

/** Врачи и слоты (design/doctors-list.md, booking.md). */
export const DoctorsAndSlots: Story = {
  render: () => (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      <MpStatusBadge status="ACTIVE" />
      <MpStatusBadge status="INACTIVE" />
      <MpStatusBadge status="AVAILABLE" />
      <MpStatusBadge status="BOOKED" />
    </Stack>
  ),
};

export const All: Story = {
  render: () => (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', maxWidth: 560 }}>
      {allStatuses.map((status) => (
        <MpStatusBadge key={status} status={status} />
      ))}
    </Stack>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
      <MpStatusBadge status="SUBMITTED" />
      <MpStatusBadge status="SUBMITTED" size="medium" />
      <MpStatusBadge status="FAILED" label="Свой текст" />
    </Stack>
  ),
};
