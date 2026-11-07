'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { DoctorListItem, Specialization } from '@mp/contracts';
import {
  LinkButton,
  MpAlert,
  MpButton,
  MpCheckbox,
  MpDialog,
  MpDialogActions,
  MpDialogContent,
  MpSelect,
  MpTextField,
  Stack,
  Typography,
  useToast,
} from '@/shared/ui';
import { ApiError, toApiError } from '@/shared/api/errors';
import { browserApi } from '@/shared/api/browser';
import { DAY_LABELS, isFormField, schedulePreview, validateDoctorForm } from './validate';
import type { DoctorFormField, DoctorFormErrors, DoctorFormValues } from './validate';

/**
 * Форма врача (3.2): создание и редактирование в одном компоненте
 * (разница — наличие id/статуса, макет design/doctor-form.md).
 *
 * - клиентская валидация даёт мгновенные подсказки, но иСТИНА — сервер:
 *   ошибки 400 с полем (ApiError.field) подмешиваются поверх клиентских;
 * - двойной submit заблокирован синхронным ref + loading кнопки (AC);
 * - несохранённые изменения ловит beforeunload (состояние макета).
 */

interface DoctorFormBase {
  /** Справочник специализаций (SSR-загрузка страницей). */
  specializations: Pick<Specialization, 'id' | 'name'>[];
}

export type DoctorFormProps = DoctorFormBase &
  ({ mode: 'create'; initial?: undefined } | { mode: 'edit'; initial: DoctorListItem });

/** Границы длительности приёма (3.2: entities/schedule — 5…240 мин). */
const DURATION_MIN = 5;
const DURATION_MAX = 240;

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Активен' },
  { value: 'INACTIVE', label: 'Архив' },
];

function toValues(doctor?: DoctorListItem): DoctorFormValues {
  return {
    firstName: doctor?.firstName ?? '',
    lastName: doctor?.lastName ?? '',
    middleName: doctor?.middleName ?? '',
    specializationId: doctor?.specializationId ?? '',
    startTime: doctor?.schedule.startTime ?? '09:00',
    endTime: doctor?.schedule.endTime ?? '18:00',
    durationMinutes: doctor?.schedule.durationMinutes ?? 30,
    workDays: doctor ? [...doctor.schedule.workDays] : [1, 2, 3, 4, 5],
    createAccount: false,
    email: '',
    password: '',
  };
}

function sameValues(a: DoctorFormValues, b: DoctorFormValues): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function DoctorForm({ mode, initial, specializations }: DoctorFormProps): React.JSX.Element {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = useState<DoctorFormValues>(() => toValues(initial));
  const [status, setStatus] = useState(initial?.status ?? 'ACTIVE');
  const [errors, setErrors] = useState<DoctorFormErrors>({});
  const [serverError, setServerError] = useState<{ message: string; requestId?: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  /** Синхронная защита от двойного submit: setState асинхронен (AC 3.2). */
  const submittingRef = useRef(false);

  const dirty = useMemo(() => {
    const base = toValues(initial);
    return (
      !sameValues(values, base) || (mode === 'edit' && status !== (initial?.status ?? 'ACTIVE'))
    );
  }, [values, status, initial, mode]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function patch<K extends keyof DoctorFormValues>(
    key: K,
    value: DoctorFormValues[K],
    errorKey?: string,
  ): void {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errorKey && isFormField(errorKey)) {
      setErrors((prev) => {
        if (!prev[errorKey as DoctorFormField]) return prev;
        const next = { ...prev };
        delete next[errorKey as DoctorFormField];
        return next;
      });
    }
  }

  async function save(nextStatus?: 'ACTIVE' | 'INACTIVE'): Promise<void> {
    if (submittingRef.current) return;

    const clientErrors = validateDoctorForm(values);
    setErrors(clientErrors);
    setServerError(null);
    if (Object.keys(clientErrors).length > 0) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const payload = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        ...(values.middleName.trim() ? { middleName: values.middleName.trim() } : {}),
        specializationId: values.specializationId,
        schedule: {
          startTime: values.startTime,
          endTime: values.endTime,
          durationMinutes: values.durationMinutes,
          workDays: [...values.workDays].sort((a, b) => a - b),
        },
      };

      if (mode === 'create') {
        if (values.createAccount) {
          // 9.1: сага в identity — пользователь DOCTOR + врач с userId
          await browserApi.identity.registerDoctor({
            ...payload,
            email: values.email.trim(),
            password: values.password,
          });
        } else {
          await browserApi.catalog.createDoctor(payload);
        }
      } else {
        await browserApi.catalog.updateDoctor(initial.id, {
          id: initial.id,
          ...payload,
          status: nextStatus ?? status,
        });
      }

      toast.success(nextStatus === 'INACTIVE' ? 'Врач отправлен в архив' : 'Врач сохранён');
      router.push('/admin/doctors');
      router.refresh();
    } catch (caught) {
      const apiError: ApiError = toApiError(caught);
      if (apiError.field && isFormField(apiError.field)) {
        setErrors((prev) => ({ ...prev, [apiError.field as DoctorFormField]: apiError.message }));
      } else {
        setServerError({
          message: apiError.message,
          ...(apiError.requestId ? { requestId: apiError.requestId } : {}),
        });
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void save();
  }

  const preview = schedulePreview(values);
  const firstDayLabel = DAY_LABELS.find((day) => day.value === values.workDays[0])?.label ?? 'Пн';

  return (
    <Stack component="form" spacing={2} sx={{ maxWidth: 760 }} noValidate onSubmit={onSubmit}>
      {serverError ? (
        <MpAlert severity="error" title="Не удалось сохранить" role="alert">
          {serverError.message}
          {serverError.requestId ? (
            <Typography variant="caption" sx={{ display: 'block' }}>
              requestId: {serverError.requestId}
            </Typography>
          ) : null}
        </MpAlert>
      ) : null}

      <Typography variant="h6">Основная информация</Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}
      >
        <MpTextField
          label="Фамилия"
          required
          fullWidth
          value={values.lastName}
          error={Boolean(errors.lastName)}
          {...(errors.lastName ? { helperText: errors.lastName } : {})}
          onChange={(event) => patch('lastName', event.target.value, 'lastName')}
        />
        <MpTextField
          label="Имя"
          required
          fullWidth
          value={values.firstName}
          error={Boolean(errors.firstName)}
          {...(errors.firstName ? { helperText: errors.firstName } : {})}
          onChange={(event) => patch('firstName', event.target.value, 'firstName')}
        />
        <MpTextField
          label="Отчество"
          fullWidth
          value={values.middleName}
          onChange={(event) => patch('middleName', event.target.value)}
        />
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}
      >
        <MpSelect
          label="Специализация"
          required
          placeholder="Не выбрано"
          value={values.specializationId}
          options={specializations.map((spec) => ({ value: spec.id, label: spec.name }))}
          error={Boolean(errors.specializationId)}
          {...(errors.specializationId ? { helperText: errors.specializationId } : {})}
          onChange={(event) => patch('specializationId', event.target.value, 'specializationId')}
        />
        {mode === 'edit' ? (
          <MpSelect
            label="Статус"
            value={status}
            options={STATUS_OPTIONS}
            onChange={(event) => setStatus(event.target.value as 'ACTIVE' | 'INACTIVE')}
          />
        ) : null}
      </Stack>

      <Typography variant="h6">Расписание</Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { xs: 'stretch', sm: 'center' }, flexWrap: 'wrap' }}
      >
        <MpTextField
          label="Начало дня"
          type="time"
          sx={{ width: { xs: '100%', sm: 160 } }}
          slotProps={{ htmlInput: { step: 300 } }}
          value={values.startTime}
          error={Boolean(errors['schedule.startTime'])}
          {...(errors['schedule.startTime'] ? { helperText: errors['schedule.startTime'] } : {})}
          onChange={(event) => patch('startTime', event.target.value, 'schedule.startTime')}
        />
        <MpTextField
          label="Конец дня"
          type="time"
          sx={{ width: { xs: '100%', sm: 160 } }}
          slotProps={{ htmlInput: { step: 300 } }}
          value={values.endTime}
          error={Boolean(errors['schedule.endTime'])}
          {...(errors['schedule.endTime'] ? { helperText: errors['schedule.endTime'] } : {})}
          onChange={(event) => patch('endTime', event.target.value, 'schedule.endTime')}
        />
        <MpTextField
          label="Длительность приёма"
          type="number"
          value={values.durationMinutes}
          error={Boolean(errors['schedule.durationMinutes'])}
          {...(errors['schedule.durationMinutes']
            ? { helperText: errors['schedule.durationMinutes'] }
            : { helperText: '5–240 мин, шаг 5' })}
          slotProps={{ htmlInput: { min: DURATION_MIN, max: DURATION_MAX, step: 5 } }}
          sx={{ width: 200 }}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next))
              patch('durationMinutes', next, 'schedule.durationMinutes');
          }}
          onBlur={(event) => {
            // ручной ввод зажимается в доменные границы 5–240 (entities/schedule)
            const clamped = Math.min(
              DURATION_MAX,
              Math.max(DURATION_MIN, Number(event.target.value) || DURATION_MIN),
            );
            if (clamped !== values.durationMinutes) {
              patch('durationMinutes', clamped, 'schedule.durationMinutes');
            }
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
              patch(
                'workDays',
                next.sort((a, b) => a - b),
                'schedule.workDays',
              );
            }}
          />
        ))}
      </Stack>
      {errors['schedule.workDays'] ? (
        <Typography variant="caption" color="error" role="alert">
          {errors['schedule.workDays']}
        </Typography>
      ) : null}

      {mode === 'create' ? (
        <>
          <Typography variant="h6">Учётная запись врача</Typography>
          <MpCheckbox
            label="Создать учётную запись (вход в портал с ролью врача)"
            checked={values.createAccount}
            onChange={(event) => patch('createAccount', event.target.checked)}
          />
          {values.createAccount ? (
            <Stack spacing={2}>
              <MpTextField
                label="Email"
                required
                type="email"
                value={values.email}
                error={Boolean(errors.email)}
                {...(errors.email ? { helperText: errors.email } : {})}
                onChange={(event) => patch('email', event.target.value, 'email')}
              />
              <MpTextField
                label="Пароль"
                required
                type="password"
                value={values.password}
                error={Boolean(errors.password)}
                {...(errors.password ? { helperText: errors.password } : {})}
                onChange={(event) => patch('password', event.target.value, 'password')}
              />
            </Stack>
          ) : null}
        </>
      ) : null}

      {preview ? (
        <Typography variant="body2" color="text.secondary" data-testid="slots-preview">
          {`Превью слотов: ${firstDayLabel} ${preview.times.join(', ')}${
            preview.perDay > preview.times.length ? ', …' : ''
          } · всего ${preview.perDay} окон/день`}
        </Typography>
      ) : null}

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
        <MpButton type="submit" variant="contained" loading={submitting}>
          Сохранить
        </MpButton>
        <LinkButton href="/admin/doctors" variant="outlined" color="inherit" disabled={submitting}>
          К списку
        </LinkButton>
        {mode === 'edit' && status === 'ACTIVE' ? (
          <MpButton
            variant="outlined"
            color="inherit"
            disabled={submitting}
            onClick={() => setArchiveOpen(true)}
            sx={{ ml: 'auto' }}
          >
            Архивировать
          </MpButton>
        ) : null}
      </Stack>

      <MpDialog
        open={archiveOpen}
        title="Архивировать врача?"
        onClose={() => setArchiveOpen(false)}
      >
        <MpDialogContent>
          <Typography>Врач исчезнет из записи на приём, история приёмов сохранится.</Typography>
        </MpDialogContent>
        <MpDialogActions>
          <MpButton color="inherit" onClick={() => setArchiveOpen(false)}>
            Отмена
          </MpButton>
          <MpButton
            variant="contained"
            loading={submitting}
            onClick={() => {
              setArchiveOpen(false);
              void save('INACTIVE');
            }}
          >
            Архивировать
          </MpButton>
        </MpDialogActions>
      </MpDialog>
    </Stack>
  );
}
