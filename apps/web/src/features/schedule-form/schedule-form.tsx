'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DoctorSchedule } from '@mp/contracts';
import {
  MpAlert,
  MpButton,
  MpCheckbox,
  MpSelect,
  MpTextField,
  Stack,
  Typography,
  useToast,
} from '@/shared/ui';
import {
  DAY_LABELS,
  DURATION_OPTIONS,
  type ScheduleErrors,
  type ScheduleField,
  schedulePreview,
  type ScheduleValues,
  validateScheduleFields,
} from '@/shared/lib';
import { browserApi } from '@/shared/api/browser';
import { toApiError } from '@/shared/api/errors';

/**
 * Форма расписания врача (10.4, Этап 2.1): врач меняет рабочий период,
 * длительность приёма и рабочие дни СВОЕЙ карточки (id берётся из токена —
 * PUT /api/catalog/doctors/me/schedule). Поля и валидация — общий слайс
 * shared/lib/schedule (DRY с админ-формой 3.2); истина — сервер: ошибки
 * 400 с полем подмешиваются поверх клиентских.
 *
 * После сохранения: `doctor.updated.v1` → scheduling обновляет копию
 * расписания и пересчитывает слоты (< 5 с, 5.1) — `router.refresh()`
 * перечитывает SSR-данные страницы.
 */
export function ScheduleForm({ initial }: { initial: DoctorSchedule }): React.JSX.Element {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = useState<ScheduleValues>({
    startTime: initial.startTime,
    endTime: initial.endTime,
    durationMinutes: initial.durationMinutes,
    workDays: [...initial.workDays],
  });
  const [errors, setErrors] = useState<ScheduleErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preview = schedulePreview(values);
  const firstDayLabel = DAY_LABELS.find((day) => day.value === values.workDays[0])?.label ?? 'Пн';

  function clearError(field: ScheduleField): void {
    setErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function submit(): Promise<void> {
    const found = validateScheduleFields(values);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await browserApi.catalog.updateMySchedule({
        schedule: {
          startTime: values.startTime,
          endTime: values.endTime,
          durationMinutes: values.durationMinutes,
          workDays: [...values.workDays].sort((a, b) => a - b),
        },
      });
      toast.success('Расписание обновлено');
      router.refresh();
    } catch (caught) {
      const apiError = toApiError(caught);
      const field = apiError.field;
      if (field && field.startsWith('schedule.')) {
        setErrors({ [field]: apiError.message } as ScheduleErrors);
      } else {
        setFormError(
          `${apiError.message}${apiError.requestId ? ` (requestId: ${apiError.requestId})` : ''}`,
        );
      }
      toast.error(apiError.message, apiError.requestId);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={2}>
      {formError ? (
        <MpAlert severity="error" role="alert">
          {formError}
        </MpAlert>
      ) : null}

      <Typography variant="h6">Расписание</Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { xs: 'stretch', sm: 'center' }, flexWrap: 'wrap' }}
      >
        <MpTextField
          label="Начало дня"
          type="time"
          size="small"
          sx={{ width: { xs: '100%', sm: 160 } }}
          slotProps={{ htmlInput: { step: 300 } }}
          value={values.startTime}
          error={Boolean(errors['schedule.startTime'])}
          {...(errors['schedule.startTime'] ? { helperText: errors['schedule.startTime'] } : {})}
          onChange={(event) => {
            setValues((prev) => ({ ...prev, startTime: event.target.value }));
            clearError('schedule.startTime');
            clearError('schedule.durationMinutes');
          }}
        />
        <MpTextField
          label="Конец дня"
          type="time"
          size="small"
          sx={{ width: { xs: '100%', sm: 160 } }}
          slotProps={{ htmlInput: { step: 300 } }}
          value={values.endTime}
          error={Boolean(errors['schedule.endTime'])}
          {...(errors['schedule.endTime'] ? { helperText: errors['schedule.endTime'] } : {})}
          onChange={(event) => {
            setValues((prev) => ({ ...prev, endTime: event.target.value }));
            clearError('schedule.endTime');
            clearError('schedule.durationMinutes');
          }}
        />
        <MpSelect
          label="Длительность приёма"
          required
          size="small"
          // не во всю строку: в одном ряду с полями времени (design/doctor-form.md)
          fullWidth={false}
          sx={{ width: 200 }}
          value={values.durationMinutes}
          options={DURATION_OPTIONS}
          error={Boolean(errors['schedule.durationMinutes'])}
          {...(errors['schedule.durationMinutes']
            ? { helperText: errors['schedule.durationMinutes'] }
            : {})}
          onChange={(event) => {
            setValues((prev) => ({ ...prev, durationMinutes: Number(event.target.value) }));
            clearError('schedule.durationMinutes');
          }}
        />
      </Stack>

      <Typography variant="subtitle2">Рабочие дни</Typography>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        {DAY_LABELS.map((day) => (
          <MpCheckbox
            key={day.value}
            label={day.label}
            checked={values.workDays.includes(day.value)}
            onChange={(event) => {
              const next = event.target.checked
                ? [...values.workDays, day.value]
                : values.workDays.filter((value) => value !== day.value);
              setValues((prev) => ({
                ...prev,
                workDays: next.sort((a, b) => a - b),
              }));
              clearError('schedule.workDays');
            }}
          />
        ))}
      </Stack>
      {errors['schedule.workDays'] ? (
        <Typography variant="caption" color="error" role="alert">
          {errors['schedule.workDays']}
        </Typography>
      ) : null}

      {/* Превью слотов (макет doctor-form): живой пересчёт период/длительность */}
      {preview ? (
        <MpAlert severity="info">
          <b>Превью слотов:</b> {firstDayLabel} {preview.times.join(' · ')}
          {preview.perDay > preview.times.length ? ' · …' : ''} — <b>{preview.perDay} окон/день</b>
          {' (живой пересчёт: период кратен длительности)'}
        </MpAlert>
      ) : null}

      <MpAlert severity="info">
        Изменения применяются к будущим слотам: расписание обновится в записи на приём в течение
        нескольких секунд. Удалённые окна уже занятых приёмов не затрагиваются.
      </MpAlert>

      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <MpButton variant="contained" loading={saving} onClick={() => void submit()}>
          Сохранить расписание
        </MpButton>
        <Typography variant="caption" color="text.secondary">
          Правила: период кратен длительности, start &lt; end, ≥ 1 рабочий день
        </Typography>
      </Stack>
    </Stack>
  );
}
