'use client';

import { useEffect, useState } from 'react';
import type { Appointment, DoctorSchedule } from '@mp/contracts';
import {
  Box,
  MpAlert,
  MpAutocomplete,
  MpButton,
  MpDialog,
  MpDialogActions,
  MpDialogContent,
  mpTokens,
  Stack,
  Typography,
  useToast,
} from '@/shared/ui';
import { formatMinutes, formatSlot, toMinutes } from '@/shared/lib';
import { browserApi } from '@/shared/api/browser';
import { toApiError } from '@/shared/api/errors';

export interface RescheduleDialogProps {
  appointment: Appointment;
  /** Справочник врачей: id, ФИО, специализация (для загрузки слотов). */
  doctors: Array<{ id: string; name: string; specializationId?: string }>;
  open: boolean;
  onClose: () => void;
  /** После успешного переноса: закрыть диалог и обновить список. */
  onChanged: () => void;
}

const DAY_NAMES = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;
/** Недельная навигация: старт — текущая дата, вперёд максимум 4 недели. */
const MAX_FORWARD_WEEKS = 4;

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIso(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** 1 = Пн … 7 = Вс (как в workDays расписания). */
function isoDayOfWeek(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1;
}

function fmtDay(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Диалог переноса записи (10.3, Этап 2.1): врач (поиск, максимум 10 опций
 * в списке) + недельный вид слотов по шаблону [дата] → [время]:
 * старт — неделя от текущей даты, ‹/› листает, вперёд максимум 4 недели;
 * доступные слоты — зелёные, занятые/нерабочие/прошедшие — серые (недоступные).
 * `PUT /api/scheduling/appointments/:id/reschedule` — только ADMIN
 * (проверяется и на gateway, и в сервисе); статус записи не меняется.
 */
export function RescheduleDialog({
  appointment,
  doctors,
  open,
  onClose,
  onChanged,
}: RescheduleDialogProps): React.JSX.Element {
  const toast = useToast();

  const today = startOfToday();
  const todayIso = toIso(today);
  const [doctorId, setDoctorId] = useState(appointment.doctorId);
  const [weekStart, setWeekStart] = useState<Date>(today);
  // Текущий слот записи предвыбирается, если попадает в первую неделю
  const [selected, setSelected] = useState<{ localDate: string; start: string } | null>(() =>
    appointment.slot.localDate >= todayIso && appointment.slot.localDate <= toIso(addDays(today, 6))
      ? { localDate: appointment.slot.localDate, start: appointment.slot.start }
      : null,
  );
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [freeKeys, setFreeKeys] = useState<Set<string>>(new Set());
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState('');

  const doctor = doctors.find((item) => item.id === doctorId);
  const specId = doctor?.specializationId;
  // Примитивы в deps эффекта: объект Date пересоздаётся каждый рендер —
  // иначе fetch-slots зацикливается («Загрузка слотов…» не исчезает)
  const weekStartIso = toIso(weekStart);
  const weekEndIso = toIso(addDays(weekStart, 6));
  /** Для подписи диапазона недели (только рендер, не deps эффектов). */
  const weekEnd = addDays(weekStart, 6);

  // Расписание целевого врача (сетка времени + рабочие дни)
  useEffect(() => {
    if (!open || !doctorId) return;
    let cancelled = false;
    setScheduleLoading(true);
    browserApi.scheduling
      .getDoctorSchedule(doctorId)
      .then((value) => {
        if (!cancelled) setSchedule(value);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(toApiError(caught).message);
      })
      .finally(() => {
        if (!cancelled) setScheduleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, doctorId]);

  // Свободные слоты недели (одним запросом, фильтр по врачу)
  useEffect(() => {
    if (!open || !specId) return;
    let cancelled = false;
    setSlotsLoading(true);
    browserApi.scheduling
      .getSlots({ specId, from: weekStartIso, to: weekEndIso })
      .then((list) => {
        if (cancelled) return;
        setFreeKeys(
          new Set(
            list
              .filter((slot) => slot.doctorId === doctorId)
              .map((slot) => `${slot.localDate}|${slot.start}`),
          ),
        );
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(toApiError(caught).message);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, specId, doctorId, weekStartIso, weekEndIso]);

  const prevWeekDisabled = toIso(weekStart) <= todayIso;
  const nextWeekDisabled = toIso(weekStart) >= toIso(addDays(today, MAX_FORWARD_WEEKS * 7 - 7));

  async function submit(): Promise<void> {
    if (!selected) {
      setError('Выберите доступный слот');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await browserApi.scheduling.rescheduleAppointment(appointment.id, {
        ...(doctorId !== appointment.doctorId ? { doctorId } : {}),
        localDate: selected.localDate,
        start: selected.start,
        ...(reason.trim().length >= 3 ? { reason: reason.trim() } : {}),
      });
      toast.success('Запись перенесена');
      onChanged();
    } catch (caught) {
      const apiError = toApiError(caught);
      if (apiError.status === 409 && apiError.code === 'SLOT_TAKEN') {
        setError('Слот уже занят — выберите соседний');
      } else if (apiError.status === 409 || apiError.field) {
        setError(apiError.message);
      } else {
        setError(
          `${apiError.message}${apiError.requestId ? ` (requestId: ${apiError.requestId})` : ''}`,
        );
      }
      toast.error(apiError.message, apiError.requestId);
    } finally {
      setSaving(false);
    }
  }

  /** Неделя от текущей даты: 7 дней, каждый — сетка времени расписания. */
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  return (
    <MpDialog
      open={open}
      title="Перенос записи"
      subtitle={`Пациент: ${appointment.patientName} · сейчас ${formatSlot(
        appointment.slot.localDate,
        appointment.slot.start,
      )} · ${appointment.specializationName}`}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <MpDialogContent sx={{ minHeight: 320 }}>
        {/* NB: MUI задаёт padding-top: 0 контенту после заголовка
            (.MuiDialogTitle-root + ...) — зазор у хедера даём margin'ом
            первого блока, иначе плавающая метка врача слипается с хедером */}
        {error ? (
          <MpAlert severity="error" role="alert" sx={{ mb: 2 }}>
            {error}
          </MpAlert>
        ) : null}

        <Stack spacing={2} sx={{ mt: 2 }}>
          {/* Врач: поиск + мультиселект-стиль, максимум 10 опций в списке (как в фильтрах) */}
          <MpAutocomplete
            label="Врач"
            placeholder="Поиск по ФИО"
            options={doctors}
            getOptionLabel={(item) => item.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={doctors.find((item) => item.id === doctorId) ?? null}
            onChange={(_, value) => {
              setDoctorId(value?.id ?? appointment.doctorId);
              setSelected(null);
              setError(null);
            }}
            fullWidth
          />

          {/* Навигация по неделям: старт — текущая дата, вперёд максимум 4 недели */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <MpButton
              size="small"
              variant="outlined"
              color="neutral"
              disabled={prevWeekDisabled}
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              ‹ Неделя
            </MpButton>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              {fmtDay(weekStart)} – {fmtDay(weekEnd)}
            </Typography>
            <MpButton
              size="small"
              variant="outlined"
              color="neutral"
              disabled={nextWeekDisabled}
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              Неделя ›
            </MpButton>
          </Stack>

          {/* Недельный вид: [дата] → [время доступно/недоступно] */}
          {schedule ? (
            <Stack spacing={1.5}>
              {days.map((day) => {
                const iso = toIso(day);
                const working = schedule.workDays.includes(isoDayOfWeek(day));
                const dayName = DAY_NAMES[isoDayOfWeek(day) - 1];
                const startMin = toMinutes(schedule.startTime);
                const endMin = toMinutes(schedule.endTime);
                const times: string[] = [];
                if (startMin !== null && endMin !== null) {
                  for (
                    let minute = startMin;
                    minute + schedule.durationMinutes <= endMin;
                    minute += schedule.durationMinutes
                  ) {
                    times.push(formatMinutes(minute));
                  }
                }

                return (
                  <Box key={iso}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {fmtDay(day)} {dayName}
                      </Typography>
                      {iso === todayIso ? (
                        <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                          сегодня
                        </Typography>
                      ) : null}
                      {!working ? (
                        <Typography variant="caption" color="text.secondary">
                          нерабочий день
                        </Typography>
                      ) : null}
                    </Stack>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                      {times.map((time) => {
                        const key = `${iso}|${time}`;
                        const available = working && freeKeys.has(key);
                        const isSelected = selected?.localDate === iso && selected?.start === time;
                        return (
                          <Box
                            key={key}
                            component="button"
                            type="button"
                            disabled={!available}
                            onClick={() => setSelected({ localDate: iso, start: time })}
                            sx={{
                              height: 28,
                              minWidth: 64,
                              px: 1,
                              border: '1px solid',
                              borderColor: isSelected ? 'primary.main' : 'transparent',
                              borderRadius: '8px',
                              fontFamily: 'inherit',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: available ? 'pointer' : 'not-allowed',
                              backgroundColor: isSelected
                                ? 'primary.main'
                                : available
                                  ? 'success.light'
                                  : mpTokens.neutral[100],
                              color: isSelected
                                ? 'primary.contrastText'
                                : available
                                  ? 'success.dark'
                                  : mpTokens.neutral[400],
                            }}
                          >
                            {time}
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {scheduleLoading
                ? 'Загрузка расписания…'
                : 'Расписание врача недоступно — проверьте врача или повторите'}
            </Typography>
          )}

          {slotsLoading ? (
            <Typography variant="caption" color="text.secondary">
              Загрузка слотов…
            </Typography>
          ) : null}

          <MpAlert severity="info">
            <b>Превью:</b>{' '}
            {selected ? `${formatSlot(selected.localDate, selected.start)}` : 'слот не выбран'} —
            зелёные слоты доступны для записи, серые заняты или недоступны (нерабочий день/прошлое).
          </MpAlert>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Причина переноса (необязательно, от 3 символов — попадёт в журнал)
            </Typography>
            <Box
              component="textarea"
              value={reason}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                setReason(event.target.value)
              }
              rows={2}
              placeholder="Пациент попросил перенести"
              sx={{
                width: '100%',
                boxSizing: 'border-box',
                p: 1,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '8px',
                fontFamily: 'inherit',
                fontSize: 14,
                resize: 'vertical',
                '&:focus': { outline: 'none', borderColor: 'primary.main' },
              }}
            />
          </Box>
        </Stack>
      </MpDialogContent>
      <MpDialogActions>
        <MpButton variant="text" color="neutral" onClick={onClose}>
          Отмена
        </MpButton>
        <MpButton variant="contained" loading={saving} onClick={() => void submit()}>
          Перенести
        </MpButton>
      </MpDialogActions>
    </MpDialog>
  );
}
