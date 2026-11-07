'use client';

import type { UpdatePatientRequest } from '@mp/contracts';
import { browserApi } from '@/shared/api/browser';
import {
  toIsoDate,
  toPatientFormValues,
  validatePatientForm,
  type PatientFormValues,
} from './validate';

/**
 * Сохранение профиля (4.2): PUT /api/patient/:id через BFF; id идёт в тело
 * (сверка на сервере — «урок текущей системы», прямой PUT с чужим id → 400).
 * Ошибки полей (ApiError.field) обрабатывает форма.
 */
export async function savePatient(
  patientId: string,
  values: PatientFormValues,
): Promise<Awaited<ReturnType<typeof browserApi.patient.update>>> {
  const body: UpdatePatientRequest = {
    id: patientId,
    email: values.email.trim(),
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    ...(values.middleName.trim() ? { middleName: values.middleName.trim() } : {}),
    birthDate: values.birthDate ? toIsoDate(values.birthDate) : toIsoDate(new Date(0)),
  };
  return browserApi.patient.update(patientId, body);
}

export { toPatientFormValues, toIsoDate, validatePatientForm };
export type { PatientFormErrors, PatientFormValues } from './validate';
