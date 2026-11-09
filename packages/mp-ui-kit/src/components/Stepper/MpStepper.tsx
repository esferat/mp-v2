import Box from '@mui/material/Box';
import Step from '@mui/material/Step';
import StepButton from '@mui/material/StepButton';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import { forwardRef } from 'react';

export interface MpStepperProps {
  /** Подписи шагов («Направление и дата», «Врач и время», «Подтверждение»). */
  steps: ReadonlyArray<string>;
  /** Активный шаг (с 0, как в MUI). */
  activeStep: number;
  /** Клик по шагу (нелинейный мастер; без обработчика шаги не кликабельны). */
  onStepClick?: (index: number) => void;
  /** Показывать подписи шагов. @default false (макеты: только точки «○───●───○») */
  showLabels?: boolean;
  /** Ориентация. @default 'horizontal' */
  orientation?: 'horizontal' | 'vertical';
  /** Размер точек. @default 'small' */
  size?: 'small' | 'medium';
  className?: string;
}

/** Точка шага: ○ — предстоит, ● — активен, ✓ — пройден (макеты booking.md, auth-signup.md). */
function StepDot({
  active,
  completed,
  diameter,
}: {
  active: boolean;
  completed: boolean;
  diameter: number;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        color: active || completed ? 'primary.main' : 'text.disabled',
      }}
    >
      <svg
        width={diameter}
        height={diameter}
        viewBox="0 0 16 16"
        aria-hidden
        focusable="false"
        style={{ display: 'block', flexShrink: 0 }}
      >
        <circle
          cx="8"
          cy="8"
          r="6"
          fill={active || completed ? 'currentColor' : 'transparent'}
          stroke="currentColor"
          strokeWidth="2"
        />
        {completed ? (
          <path
            d="M5 8.2l2 2 4-4"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null}
      </svg>
    </Box>
  );
}

/**
 * Индикатор шагов мастера (booking.md, auth-signup.md): компактные точки
 * «○───●───○» с разделителем, опционально — подписи шагов.
 *
 * @example
 * <MpStepper steps={['Направление и дата', 'Врач и время', 'Подтверждение']} activeStep={0} />
 */
export const MpStepper = forwardRef<HTMLDivElement, MpStepperProps>(function MpStepper(
  {
    steps,
    activeStep,
    onStepClick,
    showLabels = false,
    orientation = 'horizontal',
    size = 'small',
    className,
  },
  ref,
) {
  const diameter = size === 'small' ? 14 : 18;

  return (
    <Stepper
      ref={ref}
      className={className}
      activeStep={activeStep}
      orientation={orientation}
      sx={{
        '& .MuiStepConnector-line': { borderColor: 'divider' },
        '& .MuiStepLabel-label': {
          color: 'text.secondary',
          '&.Mui-active, &.Mui-completed': { color: 'text.primary' },
        },
        '& .MuiStepLabel-iconContainer': { pr: showLabels ? 1 : 0 },
      }}
    >
      {steps.map((label, index) => {
        const active = index === activeStep;
        const completed = index < activeStep;
        const dot = <StepDot active={active} completed={completed} diameter={diameter} />;

        return (
          <Step key={label} completed={completed} active={active}>
            {onStepClick ? (
              <StepButton
                icon={dot}
                onClick={() => onStepClick(index)}
                aria-label={`Шаг ${index + 1}: ${label}`}
              >
                {showLabels ? label : ''}
              </StepButton>
            ) : (
              <StepLabel icon={dot} aria-label={`Шаг ${index + 1}: ${label}`}>
                {showLabels ? label : ''}
              </StepLabel>
            )}
          </Step>
        );
      })}
    </Stepper>
  );
});
