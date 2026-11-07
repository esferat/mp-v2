'use client';

import type { Patient } from '@mp/contracts';

/**
 * Форма профиля (4.2): клиентское зеркало серверных правил (истина — сервер,
 * ошибки 400 с полем подмешиваются поверх клиентских).
 */
export interface PatientFormValues {
  email: string;
  firstName: string;
  lastName: string;
  middleName: string;
  /** null — пусто. */
  birthDate: Date | null;
}

export type PatientFormField = 'email' | 'firstName' | 'lastName' | 'birthDate';

export type PatientFormErrors = Partial<Record<PatientFormField, string>>;

export function toPatientFormValues(patient: Patient): PatientFormValues {
  return {
    email: patient.email,
    firstName: patient.firstName,
    lastName: patient.lastName,
    middleName: patient.middleName ?? '',
    birthDate: patient.birthDate ? new Date(`${patient.birthDate}T00:00:00`) : null,
  };
}

export function validatePatientForm(values: PatientFormValues): PatientFormErrors {
  const errors: PatientFormErrors = {};

  if (!values.lastName.trim()) errors.lastName = 'Укажите фамилию';
  if (!values.firstName.trim()) errors.firstName = 'Укажите имя';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Некорректный email';
  }
  if (!values.birthDate || Number.isNaN(values.birthDate.getTime())) {
    errors.birthDate = 'Укажите дату рождения';
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (values.birthDate > today) errors.birthDate = 'Дата рождения не может быть в будущем';
  }

  return errors;
}

/** Дата в ISO (YYYY-MM-DD) локального timezone. */
export function toIsoDate(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
