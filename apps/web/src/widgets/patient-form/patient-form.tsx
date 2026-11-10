'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Patient } from '@mp/contracts';
import {
  DateField,
  DatePickersProvider,
  MpAlert,
  MpButton,
  MpTextField,
  Stack,
  useToast,
} from '@/shared/ui';
import { toApiError } from '@/shared/api/errors';
import {
  type PatientFormErrors,
  type PatientFormValues,
  savePatient,
  toPatientFormValues,
  validatePatientForm,
} from '@/features/save-patient';

/**
 * Форма профиля пациента (4.2: widgets/patient-form): клиентская валидация
 * для мгновенной обратной связи, истина — сервер (ошибки с полем
 * подмешиваются), сохранение без перезагрузки + toast.
 */
export function PatientForm({ patient }: { patient: Patient }): React.JSX.Element {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = useState<PatientFormValues>(() => toPatientFormValues(patient));
  const [errors, setErrors] = useState<PatientFormErrors>({});
  const [serverError, setServerError] = useState<{ message: string; requestId?: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function patch(
    key: keyof PatientFormValues,
    value: PatientFormValues[keyof PatientFormValues],
  ): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (saving) return;

    const clientErrors = validatePatientForm(values);
    setErrors(clientErrors);
    setServerError(null);
    if (Object.keys(clientErrors).length > 0) return;

    setSaving(true);
    try {
      await savePatient(patient.id, values);
      toast.success('Профиль сохранён');
      router.refresh();
    } catch (caught) {
      const apiError = toApiError(caught);
      if (apiError.field && apiError.field in errors) {
        setErrors((prev) => ({
          ...prev,
          [apiError.field as keyof PatientFormErrors]: apiError.message,
        }));
      } else {
        setServerError({
          message: apiError.message,
          ...(apiError.requestId ? { requestId: apiError.requestId } : {}),
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <DatePickersProvider>
      <Stack
        component="form"
        spacing={2}
        sx={{ maxWidth: 640 }}
        onSubmit={(event) => void onSubmit(event)}
      >
        {serverError ? (
          <MpAlert severity="error" title="Не удалось сохранить" role="alert">
            {serverError.message}
            {serverError.requestId ? <span> (requestId: {serverError.requestId})</span> : null}
          </MpAlert>
        ) : null}

        <MpTextField
          label="Фамилия"
          required
          value={values.lastName}
          error={Boolean(errors.lastName)}
          {...(errors.lastName ? { helperText: errors.lastName } : {})}
          onChange={(event) => patch('lastName', event.target.value)}
        />
        <MpTextField
          label="Имя"
          required
          value={values.firstName}
          error={Boolean(errors.firstName)}
          {...(errors.firstName ? { helperText: errors.firstName } : {})}
          onChange={(event) => patch('firstName', event.target.value)}
        />
        <MpTextField
          label="Отчество"
          value={values.middleName}
          onChange={(event) => patch('middleName', event.target.value)}
        />
        <MpTextField
          label="Email"
          required
          type="email"
          value={values.email}
          error={Boolean(errors.email)}
          {...(errors.email ? { helperText: errors.email } : {})}
          onChange={(event) => patch('email', event.target.value)}
        />
        <DateField
          label="Дата рождения"
          value={values.birthDate}
          maxDate={today}
          error={Boolean(errors.birthDate)}
          onChange={(value) => patch('birthDate', value)}
        />
        {errors.birthDate ? (
          <MpAlert severity="error" role="alert">
            {errors.birthDate}
          </MpAlert>
        ) : null}

        <Stack direction="row" spacing={1}>
          <MpButton type="submit" variant="contained" loading={saving}>
            Сохранить
          </MpButton>
        </Stack>
      </Stack>
    </DatePickersProvider>
  );
}
