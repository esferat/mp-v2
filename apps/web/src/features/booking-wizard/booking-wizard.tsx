'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SlotList, Specialization } from '@mp/contracts';
import {
  Box,
  DateField,
  DatePickersProvider,
  MpAlert,
  MpAvatar,
  MpButton,
  MpCard,
  MpCardContent,
  MpChip,
  MpDialog,
  MpDialogActions,
  MpDialogContent,
  MpSelect,
  MpStepper,
  Stack,
  Typography,
  useToast,
} from '@/shared/ui';
import { formatRuDate } from '@/shared/lib';
import { browserApi } from '@/shared/api/browser';
import { toApiError } from '@/shared/api/errors';

/**
 * Мастер записи к врачу (5.2/5.3, design/booking.md): специализация и дата →
 * свободные слоты по врачам (группировка ответа слотов, без похода в
 * админский список врачей: 3.1 AC USER → 403) → подтверждение → бронь
 * с защитой от двойного submit (AC 5.3).
 */

interface SelectedSlot {
  doctorId: string;
  doctorName: string;
  localDate: string;
  start: string;
  end: string;
}

interface DoctorSlots {
  doctorId: string;
  doctorName: string;
  slots: SlotList;
}

function groupByDoctor(slots: SlotList): DoctorSlots[] {
  const map = new Map<string, DoctorSlots>();
  for (const slot of slots) {
    const group = map.get(slot.doctorId);
    if (group) {
      group.slots.push(slot);
    } else {
      map.set(slot.doctorId, {
        doctorId: slot.doctorId,
        doctorName: slot.doctorName,
        slots: [slot],
      });
    }
  }
  return [...map.values()];
}

export function BookingWizard({
  specializations,
}: {
  specializations: Pick<Specialization, 'id' | 'name'>[];
}): React.JSX.Element {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [specId, setSpecId] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [doctorSlots, setDoctorSlots] = useState<DoctorSlots[]>([]);
  const [selected, setSelected] = useState<SelectedSlot | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [booking, setBooking] = useState(false);

  const today = new Date();
  const maxDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);

  function toIso(value: Date): string {
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  }

  async function loadSlots(day: Date): Promise<void> {
    setLoadingSlots(true);
    setStepError(null);
    try {
      const iso = toIso(day);
      const slots = await browserApi.scheduling.getSlots({ specId, from: iso, to: iso });
      setDoctorSlots(groupByDoctor(slots));
      setSelected(null);
    } catch (caught) {
      setStepError(toApiError(caught).message);
      setDoctorSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  function nextFromStep1(): void {
    if (!specId) {
      setStepError('Выберите направление');
      return;
    }
    if (!date) {
      setStepError('Выберите дату приёма');
      return;
    }
    setStepError(null);
    setStep(2);
    void loadSlots(date);
  }

  async function confirmBooking(): Promise<void> {
    if (!selected || booking) return;
    setBooking(true);
    try {
      await browserApi.scheduling.bookAppointment({
        doctorId: selected.doctorId,
        slot: { localDate: selected.localDate, start: selected.start },
      });
      setConfirmOpen(false);
      toast.success('Запись оформлена');
      router.push('/cabinet/history');
      router.refresh();
    } catch (caught) {
      const apiError = toApiError(caught);
      setConfirmOpen(false);
      if (apiError.code === 'SLOT_TAKEN') {
        toast.error('Слот только что заняли — выберите другой');
        if (date) void loadSlots(date);
      } else {
        setStepError(apiError.message);
        toast.error(apiError.message, apiError.requestId);
      }
    } finally {
      setBooking(false);
    }
  }

  const specName = specializations.find((spec) => spec.id === specId)?.name ?? '';

  // Шаги мастера (visual/booking.html): ① Спец-ия и дата → ② Врач и слот → ③ Подтверждение
  const BOOKING_STEPS = ['Направление и дата', 'Врач и слот', 'Подтверждение'];

  return (
    <DatePickersProvider>
      <Stack spacing={2} sx={{ maxWidth: 900 }}>
        <MpStepper steps={BOOKING_STEPS} activeStep={step - 1} showLabels />

        {stepError ? (
          <MpAlert severity="error" role="alert">
            {stepError}
          </MpAlert>
        ) : null}

        {step === 1 ? (
          <MpCard variant="outlined">
            <MpCardContent>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ alignItems: { sm: 'flex-start' } }}
              >
                <MpSelect
                  label="Направление"
                  required
                  placeholder="Не выбрано"
                  value={specId}
                  options={specializations.map((spec) => ({ value: spec.id, label: spec.name }))}
                  onChange={(event) => {
                    setSpecId(event.target.value);
                    setStepError(null);
                  }}
                  sx={{ minWidth: 240 }}
                />
                <DateField
                  label="Дата приёма"
                  value={date}
                  minDate={today}
                  maxDate={maxDate}
                  onChange={(value) => {
                    setDate(value);
                    setStepError(null);
                  }}
                />
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'flex-end' }}>
                <MpButton variant="contained" onClick={nextFromStep1}>
                  Далее
                </MpButton>
              </Stack>
            </MpCardContent>
          </MpCard>
        ) : null}

        {step === 2 ? (
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {`${specName} · ${date ? formatRuDate(toIso(date)) : ''}`}
            </Typography>

            {loadingSlots ? (
              <Typography color="text.secondary">Ищем свободные окна…</Typography>
            ) : doctorSlots.length === 0 && !stepError ? (
              <MpAlert severity="info">
                На эту дату свободных окон нет — выберите другой день
              </MpAlert>
            ) : (
              <Stack spacing={2}>
                {doctorSlots.map((group) => (
                  <MpCard key={group.doctorId} variant="outlined">
                    <MpCardContent>
                      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 1.5 }}>
                        <MpAvatar name={group.doctorName} />
                        <Box>
                          <Typography variant="subtitle2">{group.doctorName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {specName}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                        {group.slots.map((slot) => {
                          const isSelected =
                            selected?.doctorId === slot.doctorId && selected.start === slot.start;
                          return (
                            <MpChip
                              key={`${slot.doctorId}-${slot.start}`}
                              label={slot.start}
                              color={isSelected ? 'primary' : 'default'}
                              variant={isSelected ? 'filled' : 'outlined'}
                              onClick={() =>
                                setSelected({
                                  doctorId: slot.doctorId,
                                  doctorName: slot.doctorName,
                                  localDate: slot.localDate,
                                  start: slot.start,
                                  end: slot.end,
                                })
                              }
                            />
                          );
                        })}
                      </Stack>
                    </MpCardContent>
                  </MpCard>
                ))}
              </Stack>
            )}

            <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'space-between' }}>
              <MpButton variant="outlined" color="inherit" onClick={() => setStep(1)}>
                Назад
              </MpButton>
              <MpButton
                variant="contained"
                disabled={!selected}
                onClick={() => setConfirmOpen(true)}
              >
                {selected ? 'Далее' : 'Выберите слот'}
              </MpButton>
            </Stack>
          </Box>
        ) : null}

        <MpDialog
          open={confirmOpen}
          title="Подтвердите запись"
          onClose={() => !booking && setConfirmOpen(false)}
        >
          <MpDialogContent>
            <Stack spacing={0.5}>
              <Typography>Врач: {selected?.doctorName}</Typography>
              <Typography>Направление: {specName}</Typography>
              <Typography>
                Дата и время:{' '}
                {selected
                  ? `${formatRuDate(selected.localDate)} ${selected.start}–${selected.end}`
                  : ''}
              </Typography>
            </Stack>
          </MpDialogContent>
          <MpDialogActions>
            <MpButton color="inherit" disabled={booking} onClick={() => setConfirmOpen(false)}>
              Назад
            </MpButton>
            <MpButton variant="contained" loading={booking} onClick={() => void confirmBooking()}>
              Подтвердить
            </MpButton>
          </MpDialogActions>
        </MpDialog>
      </Stack>
    </DatePickersProvider>
  );
}
