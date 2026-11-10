import Box from '@mui/material/Box';
import Step from '@mui/material/Step';
import StepButton from '@mui/material/StepButton';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import { forwardRef } from 'react';
import { mpTokens } from '../../theme/tokens';

export interface MpStepperProps {
  /** Подписи шагов («Направление и дата», «Врач и время», «Подтверждение»). */
  steps: ReadonlyArray<string>;
  /** Активный шаг (с 0, как в MUI). */
  activeStep: number;
  /** Клик по шагу (нелинейный мастер; без обработчика шаги не кликабельны). */
  onStepClick?: (index: number) => void;
  /** Показывать подписи шагов. @default false */
  showLabels?: boolean;
  /** Ориентация. @default 'horizontal' */
  orientation?: 'horizontal' | 'vertical';
  /** Размер кружков с номерами. @default 'small' */
  size?: 'small' | 'medium';
  className?: string;
}

/**
 * Кружок с номером шага (visual/_shared.css `.step .num`): 24px круг,
 * номер внутри; активный — brand-600/белый, пройденный — brand-100/brand-800,
 * предстоящий — neutral-200/neutral-600.
 */
function StepDot({
  active,
  completed,
  index,
  diameter,
}: {
  active: boolean;
  completed: boolean;
  index: number;
  diameter: number;
}) {
  return (
    <Box
      aria-hidden
      sx={{
        width: diameter,
        height: diameter,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: diameter >= 28 ? 13 : 12,
        fontWeight: 700,
        backgroundColor: completed
          ? mpTokens.brand[100]
          : active
            ? 'primary.main'
            : mpTokens.neutral[200],
        color: completed ? mpTokens.brand[800] : active ? '#FFFFFF' : mpTokens.neutral[600],
      }}
    >
      {index + 1}
    </Box>
  );
}

/**
 * Индикатор шагов мастера (booking.md, auth-signup.md): нумерованные
 * кружки «①──②──③» с разделителями, опционально — подписи шагов.
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
  const diameter = size === 'medium' ? 28 : 24;

  return (
    <Stepper
      ref={ref}
      className={className}
      activeStep={activeStep}
      orientation={orientation}
      sx={{
        // Разделители: 2px, gray; за пройденным шагом — брендовый (booking.html)
        '& .MuiStepConnector-line': { height: 2, borderColor: mpTokens.neutral[200] },
        '& .MuiStepConnector-root.Mui-active .MuiStepConnector-line, & .MuiStep-root.Mui-completed + .MuiStepConnector-root .MuiStepConnector-line':
          { borderColor: 'primary.main' },
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
        const dot = (
          <StepDot active={active} completed={completed} index={index} diameter={diameter} />
        );

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
