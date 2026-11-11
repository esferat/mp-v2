'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DoctorListItem, SlotList, Specialization } from '@mp/contracts';
import {
  Box,
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
  MpSpinner,
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

/** ФИО врача из карточки catalog. */
function doctorFullName(
  doctor: Pick<DoctorListItem, 'lastName' | 'firstName' | 'middleName'>,
): string {
  return [doctor.lastName, doctor.firstName, doctor.middleName ?? '']
    .filter((part) => part.length > 0)
    .join(' ');
}

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

/** Рабочие дни (1 = пн … 7 = вс) → «пн, вт, ср, чт, пт». */
function formatWorkDays(workDays: readonly number[]): string {
  const days = [...workDays].sort((a, b) => a - b).map((day) => WEEKDAYS[day - 1] ?? '');
  const unique = [...new Set(days)].filter(Boolean);
  return unique.length > 0 ? unique.join(', ') : '—';
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
  /** Направление последнего перелистывания — для анимации сдвига ленты. */
  const [windowDir, setWindowDir] = useState<1 | -1>(1);
  const [booking, setBooking] = useState(false);

  /** Модальная карточка врача («Подробнее» в плитке шага 2). */
  const [infoFor, setInfoFor] = useState<SelectedDoctor | null>(null);
  const [info, setInfo] = useState<DoctorListItem | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

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

  /** «Подробнее» в плитке врача: карточка из catalog (ФИО, расписание, статус). */
  async function openDoctorInfo(target: SelectedDoctor): Promise<void> {
    setInfoFor(target);
    setInfo(null);
    setInfoError(null);
    setLoadingInfo(true);
    try {
      setInfo(await browserApi.catalog.getDoctor(target.doctorId));
    } catch (caught) {
      setInfoError(toApiError(caught).message);
    } finally {
      setLoadingInfo(false);
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
    setWindowDir(direction);
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
              /* Врачи плитками: по 4 в строке (десктоп), 2 — на планшете,
                 1 — на телефоне (макет: карточка = плитка) */
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                  gap: 1.5,
                }}
              >
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
                        height: '100%',
                      }}
                      onClick={() => {
                        setDoctor(group.doctor);
                        setStepError(null);
                      }}
                    >
                      <MpCardContent
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 1.5,
                        }}
                      >
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <MpAvatar
                            name={group.doctor.doctorName}
                            sx={{ width: 56, height: 56, fontSize: 22 }}
                          />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" noWrap>
                              {group.doctor.doctorName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {specName}
                            </Typography>
                          </Box>
                        </Stack>
                        <Typography
                          variant="caption"
                          color={group.available > 0 ? 'success.dark' : 'text.secondary'}
                          sx={{ fontWeight: 600 }}
                        >
                          {group.available > 0
                            ? `Свободно: ${group.available} из ${group.total}`
                            : `Свободных нет (занято: ${group.total})`}
                        </Typography>
                        <MpButton
                          size="small"
                          variant="outlined"
                          fullWidth
                          onClick={(event) => {
                            // не выбираем врача — открываем карточку
                            event.stopPropagation();
                            void openDoctorInfo(group.doctor);
                          }}
                        >
                          Подробнее
                        </MpButton>
                      </MpCardContent>
                    </MpCard>
                  );
                })}
              </Box>
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
              <MpSpinner label="Загружаем расписание…" minHeight={220} />
            ) : (
              /* День = колонка: горизонтальный ряд до 7 дней (на узком
                 экране — горизонтальный скролл); слоты внутри дня —
                 вертикальный столбик в одну колонку. key=windowStart
                 перемонтирует ряд при перелистывании — проигрывается
                 анимация сдвига в направлении ‹/› */
              <Box
                key={windowStart}
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  alignItems: 'flex-start',
                  overflowX: 'auto',
                  pb: 1,
                  animation: windowDir === 1 ? 'mpWeekNext 0.25s ease' : 'mpWeekPrev 0.25s ease',
                  '@keyframes mpWeekNext': {
                    from: { opacity: 0, transform: 'translateX(24px)' },
                    to: { opacity: 1, transform: 'none' },
                  },
                  '@keyframes mpWeekPrev': {
                    from: { opacity: 0, transform: 'translateX(-24px)' },
                    to: { opacity: 1, transform: 'none' },
                  },
                }}
              >
                {days.map((dayIso) => {
                  const daySlots = doctorSlots.filter((slot) => slot.localDate === dayIso);
                  const isToday = dayIso === todayIso;
                  return (
                    <MpCard
                      key={dayIso}
                      variant="flat"
                      sx={{ flex: '1 1 0', minWidth: 104, maxWidth: 160 }}
                    >
                      <MpCardContent sx={{ py: 1.5, px: 1.5 }}>
                        <Typography
                          variant="subtitle2"
                          color={daySlots.length > 0 ? 'text.primary' : 'text.secondary'}
                          sx={{ mb: 1, whiteSpace: 'nowrap' }}
                        >
                          {isToday ? (
                            <>
                              Сегодня
                              <br />
                            </>
                          ) : null}
                          {dayLabel(dayIso)}
                        </Typography>
                        {daySlots.length === 0 ? (
                          <Typography variant="caption" color="text.secondary">
                            Нет приёма
                          </Typography>
                        ) : (
                          <Stack spacing={0.5}>
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
                          </Stack>
                        )}
                      </MpCardContent>
                    </MpCard>
                  );
                })}
              </Box>
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
        {/* Карточка врача: «Подробнее» в плитке шага 2 (без выбора) */}
        <MpDialog
          open={infoFor !== null}
          title="Информация о враче"
          onClose={() => {
            if (!loadingInfo) setInfoFor(null);
          }}
        >
          <MpDialogContent>
            {loadingInfo ? (
              <MpSpinner label="Загружаем данные врача…" minHeight={140} />
            ) : infoError ? (
              <MpAlert severity="error" role="alert">
                {infoError}
              </MpAlert>
            ) : info ? (
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <MpAvatar
                    name={doctorFullName(info)}
                    {...(info.photoUrl ? { src: info.photoUrl } : {})}
                    sx={{ width: 56, height: 56, fontSize: 22 }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" noWrap>
                      {doctorFullName(info)}
                    </Typography>
                    <Typography color="text.secondary">{info.specializationName}</Typography>
                  </Box>
                </Stack>
                <Stack spacing={0.5}>
                  <Typography>
                    Статус: {info.status === 'ACTIVE' ? 'Активен' : 'Неактивен'}
                  </Typography>
                  <Typography>
                    Приём: {formatWorkDays(info.schedule.workDays)}, {info.schedule.startTime}–
                    {info.schedule.endTime}
                  </Typography>
                  <Typography>Длительность приёма: {info.schedule.durationMinutes} мин</Typography>
                  {(() => {
                    const group = doctorGroups.find(
                      (item) => item.doctor.doctorId === infoFor?.doctorId,
                    );
                    return group ? (
                      <Typography color={group.available > 0 ? 'success.dark' : 'text.secondary'}>
                        {group.available > 0
                          ? `Свободно в ближайшие 7 дней: ${group.available} из ${group.total}`
                          : `Свободных окон нет (занято: ${group.total})`}
                      </Typography>
                    ) : null;
                  })()}
                </Stack>
              </Stack>
            ) : null}
          </MpDialogContent>
          <MpDialogActions>
            <MpButton color="inherit" onClick={() => setInfoFor(null)}>
              Закрыть
            </MpButton>
            <MpButton
              variant="contained"
              disabled={!info}
              onClick={() => {
                if (!info) return;
                setDoctor({ doctorId: info.id, doctorName: doctorFullName(info) });
                setInfoFor(null);
              }}
            >
              Выбрать врача
            </MpButton>
          </MpDialogActions>
        </MpDialog>
      </Stack>
    </DatePickersProvider>
  );
}
