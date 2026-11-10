import { Box, Stack, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MpButton } from '../Button/MpButton';
import { MpStepper } from './MpStepper';

const bookingSteps = ['Направление и дата', 'Врач и время', 'Подтверждение'];

const meta = {
  title: 'Components/Stepper',
  component: MpStepper,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    steps: bookingSteps,
    activeStep: 1,
    showLabels: false,
    orientation: 'horizontal',
    size: 'small',
  },
  argTypes: {
    steps: { control: false },
    orientation: { control: 'radio', options: ['horizontal', 'vertical'] },
    size: { control: 'radio', options: ['small', 'medium'] },
  },
} satisfies Meta<typeof MpStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Мастер записи (design/booking.md, visual/booking.html): «Шаг 1 из 3  ①──②──③». */
export const WizardDots: Story = {
  render: () => {
    const [step, setStep] = useState(0);
    return (
      <Stack spacing={3} sx={{ width: 480 }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="h5">Запись к врачу</Typography>
          <Typography color="text.secondary">Шаг {step + 1} из 3</Typography>
        </Stack>
        <MpStepper steps={bookingSteps} activeStep={step} />
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <MpButton variant="text" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Назад
          </MpButton>
          <MpButton variant="contained" onClick={() => setStep((s) => Math.min(s + 1, 2))}>
            Далее
          </MpButton>
        </Stack>
      </Stack>
    );
  },
};

/** Регистрация (design/auth-signup.md): подписи шагов видны. */
export const WithLabels: Story = {
  render: () => (
    <Box sx={{ width: 480 }}>
      <MpStepper steps={['Шаг 1: Данные', 'Шаг 2: Фото и документ']} activeStep={0} showLabels />
    </Box>
  ),
};

/** Нелинейный мастер: шаги кликабельны. */
export const Clickable: Story = {
  render: () => {
    const [step, setStep] = useState(1);
    return (
      <Box sx={{ width: 480 }}>
        <MpStepper
          steps={bookingSteps}
          activeStep={step}
          onStepClick={setStep}
          showLabels
          size="medium"
        />
      </Box>
    );
  },
};
