'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SlotList, Specialization } from '@mp/contracts';
import {
  Box,
  DatePickersProvider,
  MpAlert,
  MpAvatar,
  MpButton,
  MpCard,
  MpCardContent,
  MpChip,
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
 * Мастер записи к врачу (5.2/5.3) — 4 шага:
 *   1. выбор специальности;
 *   2. выбор врача (список врачей специализации со счётчиками свободных
 *      окон в текущем 7-дневном окне);
 *   3. выбор слота и даты: вертикальная лента дней (сегодня → +6 дней),
 *      стрелки ‹/› перелистывают окно в пределах 2 месяцев от сегодня;
 *      зелёные — доступные, серые — занятые/прошедшие/недоступные;
 *   4. подтверждение → бронь с защитой от двойного submit (AC 5.3).
 *
 * Слоты запрашиваются с includeBusy=1: сервер возвращает и занятые
 * (available=false) — для серых чипов (сетка design/booking.md).
 */

const WINDOW_DAYS = 7;

interface SelectedDoctor {
  doctorId: string;
  doctorName: string;
}

interface SelectedSlot {
  doctorId: string;
  doctorName: string;
  localDate: string;
  start: string;
  end: string;
}

/** ISO-дата локального Date (без сдвига таймзоны). */
function toIso(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** ISO → Date в локальной таймзоне (YYYY-MM-DD как локальный день). */
function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function addDays(iso: string, days: number): string {
  const date = isoToDate(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

/** Минимум из двух ISO-дат (лексикографический порядок совпадает с хронологией). */
function minIso(a: string, b: string): string {
  return a < b ? a : b;
}

/** Короткая подпись дня: «11.11, вт». */
function dayLabel(iso: string): string {
  const date = isoToDate(iso);
  const dayMonth = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  const weekday = date.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '');
  return `${dayMonth}, ${weekday}`;
}

/** Врачи в порядке появления в ответе слотов, со счётчиками. */
function groupByDoctor(slots: SlotList): {
  doctor: SelectedDoctor;
  available: number;
  total: number;
}[] {
  const map = new Map<string, { doctor: SelectedDoctor; available: number; total: number }>();
  for (const slot of slots) {
    const group = map.get(slot.doctorId);
    if (!group) {
      map.set(slot.doctorId, {
        doctor: { doctorId: slot.doctorId, doctorName: slot.doctorName },
        available: slot.available ? 1 : 0,
        total: 1,
      });
    } else {
      group.total += 1;
      if (slot.available) group.available += 1;
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
  const [doctor, setDoctor] = useState<SelectedDoctor | null>(null);
  const [selected, setSelected] = useState<SelectedSlot | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slots, setSlots] = useState<SlotList>([]);
  /** Сегодняшний день в ISO — граница начала ленты (один раз на монтирование). */
  const [todayIso] = useState(() => toIso(new Date()));
  /** Начало 7-дневного окна ленты дат (шаг 3). */
  const [windowStart, setWindowStart] = useState(() => toIso(new Date()));
  const [booking, setBooking] = useState(false);

  // Максимум перелистывания — 2 месяца от сегодня (конец второго месяца)
  const maxDateIso = (() => {
    const today = isoToDate(todayIso);
    return toIso(new Date(today.getFullYear(), today.getMonth() + 2, 0));
  })();

  async function loadWindow(startIso: string): Promise<void> {
    if (!specId) return;
    setLoadingSlots(true);
    setStepError(null);
    try {
      const endIso = minIso(addDays(startIso, WINDOW_DAYS - 1), maxDateIso);
      const list = await browserApi.scheduling.getSlots({
        specId,
        from: startIso,
        to: endIso,
        includeBusy: true,
      });
      setSlots(list);
      setSelected(null);
    } catch (caught) {
      setStepError(toApiError(caught).message);
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  /** Шаг 1 → 2: направление выбрано — грузим ближайшее окно слотов. */
  function goFromSpec(): void {
    if (!specId) {
      setStepError('Выберите направление');
      return;
    }
    setStepError(null);
    setStep(2);
    setDoctor(null);
    if (slots.length === 0 && !loadingSlots) void loadWindow(windowStart);
  }

  /** Шаг 2 → 3: врач выбран (слоты окна уже загружены). */
  function goFromDoctor(): void {
    if (!doctor) {
      setStepError('Выберите врача');
      return;
    }
    setStepError(null);
    setStep(3);
    void loadWindow(windowStart);
  }

  /** Сдвиг 7-дневного окна ‹/› в границах [сегодня, +2 месяца]. */
  function moveWindow(direction: -1 | 1): void {
    const next = addDays(windowStart, direction * WINDOW_DAYS);
    const bounded = next < todayIso ? todayIso : next > maxDateIso ? maxDateIso : next;
    if (bounded === windowStart) return;
    setWindowStart(bounded);
    void loadWindow(bounded);
  }

  const windowEndIso = minIso(addDays(windowStart, WINDOW_DAYS - 1), maxDateIso);
  const canGoBackWindow = windowStart > todayIso;
  const canGoForwardWindow = windowStart < maxDateIso;

  async function confirmBooking(): Promise<void> {
    if (!selected || booking) return;
    setBooking(true);
    try {
      await browserApi.scheduling.bookAppointment({
        doctorId: selected.doctorId,
        slot: { localDate: selected.localDate, start: selected.start },
      });
      toast.success('Запись оформлена');
      router.push('/cabinet/history');
      router.refresh();
    } catch (caught) {
      const apiError = toApiError(caught);
      if (apiError.code === 'SLOT_TAKEN') {
        toast.error('Слот только что заняли — выберите другой');
        setStep(3);
        void loadWindow(windowStart);
      } else {
        toast.error(apiError.message, apiError.requestId);
      }
    } finally {
      setBooking(false);
    }
  }

  const specName = specializations.find((spec) => spec.id === specId)?.name ?? '';

  // Лента дней шага 3: окно от сегодня, максимум 7 дней
  const days: string[] = [];
  for (let i = 0; i < WINDOW_DAYS; i += 1) {
    const day = addDays(windowStart, i);
    if (day > windowEndIso) break;
    days.push(day);
  }

  const doctorSlots = doctor ? slots.filter((slot) => slot.doctorId === doctor.doctorId) : [];
  const doctorGroups = groupByDoctor(slots);
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  /** Прошедшие слоты сегодня — недоступны (серые), как и занятые. */
  function slotUnavailable(slot: {
    localDate: string;
    start: string;
    available: boolean;
  }): boolean {
    if (!slot.available) return true;
    if (slot.localDate !== todayIso) return false;
    const [h, m] = slot.start.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0) <= nowMinutes;
  }

  const BOOKING_STEPS = ['Направление', 'Врач', 'Дата и время', 'Подтверждение'];

  return (
    <DatePickersProvider>
      <Stack spacing={2} sx={{ maxWidth: 900 }}>
        <MpStepper steps={BOOKING_STEPS} activeStep={step - 1} showLabels />

        {stepError ? (
          <MpAlert severity="error" role="alert">
            {stepError}
          </MpAlert>
        ) : null}

        {/* Шаг 1: выбор специальности */}
        {step === 1 ? (
          <MpCard variant="outlined">
            <MpCardContent>
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
                sx={{ maxWidth: 360 }}
              />
              <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'flex-end' }}>
                <MpButton variant="contained" onClick={goFromSpec}>
                  Далее
                </MpButton>
              </Stack>
            </MpCardContent>
          </MpCard>
        ) : null}

        {/* Шаг 2: выбор врача */}
        {step === 2 ? (
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {specName}
            </Typography>

            {loadingSlots ? (
              <Typography color="text.secondary">Ищем врача…</Typography>
            ) : doctorGroups.length === 0 && !stepError ? (
              <MpAlert severity="info">
                На ближайшие 7 дней приёма нет — вернитесь назад и выберите другое направление
              </MpAlert>
            ) : (
              <Stack spacing={1.5}>
                {doctorGroups.map((group) => {
                  const isPicked = doctor?.doctorId === group.doctor.doctorId;
                  return (
                    <MpCard
                      key={group.doctor.doctorId}
                      variant={isPicked ? 'elevated' : 'outlined'}
                      sx={{
                        cursor: 'pointer',
                        borderColor: isPicked ? 'primary.main' : undefined,
                        borderWidth: isPicked ? 2 : undefined,
                        borderStyle: isPicked ? 'solid' : undefined,
                      }}
                      onClick={() => {
                        setDoctor(group.doctor);
                        setStepError(null);
                      }}
                    >
                      <MpCardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <MpAvatar name={group.doctor.doctorName} />
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle2">{group.doctor.doctorName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {specName}
                          </Typography>
                        </Box>
                        <Typography
                          variant="caption"
                          color={group.available > 0 ? 'success.dark' : 'text.secondary'}
                          sx={{ fontWeight: 600 }}
                        >
                          {group.available > 0
                            ? `Свободно: ${group.available} из ${group.total}`
                            : `Свободных нет (занято: ${group.total})`}
                        </Typography>
                      </MpCardContent>
                    </MpCard>
                  );
                })}
              </Stack>
            )}

            <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'space-between' }}>
              <MpButton variant="outlined" color="inherit" onClick={() => setStep(1)}>
                Назад
              </MpButton>
              <MpButton variant="contained" disabled={!doctor} onClick={goFromDoctor}>
                {doctor ? 'Далее' : 'Выберите врача'}
              </MpButton>
            </Stack>
          </Box>
        ) : null}

        {/* Шаг 3: выбор даты и слота — вертикальная лента дней окна */}
        {step === 3 ? (
          <Box>
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography variant="subtitle1">
                {`${doctor?.doctorName ?? ''} · ${specName}`}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <MpButton
                  size="small"
                  variant="outlined"
                  aria-label="Предыдущие 7 дней"
                  disabled={!canGoBackWindow || loadingSlots}
                  onClick={() => moveWindow(-1)}
                >
                  ‹
                </MpButton>
                <Typography variant="body2" sx={{ minWidth: 150, textAlign: 'center' }}>
                  {`${formatRuDate(windowStart)} — ${formatRuDate(windowEndIso)}`}
                </Typography>
                <MpButton
                  size="small"
                  variant="outlined"
                  aria-label="Следующие 7 дней"
                  disabled={!canGoForwardWindow || loadingSlots}
                  onClick={() => moveWindow(1)}
                >
                  ›
                </MpButton>
              </Stack>
            </Stack>

            {/* Легенда: зелёные — доступные, серые — занятые/недоступные */}
            <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
              <MpChip size="small" color="success" label="10:00" disabled />
              <Typography variant="caption" color="text.secondary">
                доступно
              </Typography>
              <MpChip size="small" color="neutral" label="10:30" disabled />
              <Typography variant="caption" color="text.secondary">
                занято / недоступно
              </Typography>
            </Stack>

            {loadingSlots ? (
              <Typography color="text.secondary">Загружаем расписание…</Typography>
            ) : (
              <Stack spacing={1.5}>
                {days.map((dayIso) => {
                  const daySlots = doctorSlots.filter((slot) => slot.localDate === dayIso);
                  const isToday = dayIso === todayIso;
                  return (
                    <MpCard key={dayIso} variant="flat">
                      <MpCardContent sx={{ py: 1.5 }}>
                        <Typography
                          variant="subtitle2"
                          color={daySlots.length > 0 ? 'text.primary' : 'text.secondary'}
                          sx={{ mb: 1 }}
                        >
                          {isToday ? 'Сегодня, ' : ''}
                          {dayLabel(dayIso)}
                        </Typography>
                        {daySlots.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            Нет приёма
                          </Typography>
                        ) : (
                          /* Сетка колонок (а не строки с переносом): ровные
                             колонки времени, как в расписании (booking.md) */
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
                              gap: 1,
                            }}
                          >
                            {daySlots.map((slot) => {
                              const unavailable = slotUnavailable(slot);
                              const isSelected =
                                selected?.localDate === slot.localDate &&
                                selected?.start === slot.start;
                              return (
                                <MpChip
                                  key={`${slot.localDate}-${slot.start}`}
                                  label={slot.start}
                                  size="small"
                                  color={unavailable ? 'neutral' : 'success'}
                                  selected={isSelected}
                                  variant="outlined"
                                  disabled={unavailable}
                                  sx={{ width: '100%', justifyContent: 'center' }}
                                  {...(!unavailable
                                    ? {
                                        onClick: () =>
                                          setSelected({
                                            doctorId: slot.doctorId,
                                            doctorName: slot.doctorName,
                                            localDate: slot.localDate,
                                            start: slot.start,
                                            end: slot.end,
                                          }),
                                      }
                                    : {})}
                                />
                              );
                            })}
                          </Box>
                        )}
                      </MpCardContent>
                    </MpCard>
                  );
                })}
              </Stack>
            )}

            <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'space-between' }}>
              <MpButton variant="outlined" color="inherit" onClick={() => setStep(2)}>
                Назад
              </MpButton>
              <MpButton
                variant="contained"
                disabled={!selected}
                onClick={() => {
                  setStepError(null);
                  setStep(4);
                }}
              >
                {selected ? 'Далее' : 'Выберите время'}
              </MpButton>
            </Stack>
          </Box>
        ) : null}

        {/* Шаг 4: подтверждение */}
        {step === 4 ? (
          <MpCard variant="outlined">
            <MpCardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Подтвердите запись
              </Typography>
              <Stack spacing={1} sx={{ mb: 3 }}>
                <Typography>Направление: {specName}</Typography>
                <Typography>Врач: {selected?.doctorName ?? doctor?.doctorName ?? ''}</Typography>
                <Typography>
                  Дата и время:{' '}
                  {selected
                    ? `${formatRuDate(selected.localDate)}, ${selected.start}–${selected.end}`
                    : ''}
                </Typography>
                <Typography color="text.secondary">Пациент: вы (из личного кабинета)</Typography>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                <MpButton variant="outlined" color="inherit" onClick={() => setStep(3)}>
                  Назад
                </MpButton>
                <MpButton
                  variant="contained"
                  loading={booking}
                  onClick={() => void confirmBooking()}
                >
                  Подтвердить запись
                </MpButton>
              </Stack>
            </MpCardContent>
          </MpCard>
        ) : null}
      </Stack>
    </DatePickersProvider>
  );
}
