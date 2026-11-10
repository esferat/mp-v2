import { describe, expect, it } from 'vitest';
import {
  type DoctorFormValues,
  DURATION_OPTIONS,
  schedulePreview,
  validateDoctorForm,
} from '../src/features/doctor-form/validate';

const base: DoctorFormValues = {
  firstName: 'Иван',
  lastName: 'Иванов',
  middleName: '',
  specializationId: 'sp-1',
  startTime: '09:00',
  endTime: '18:00',
  durationMinutes: 30,
  workDays: [1, 2, 3, 4, 5],
  createAccount: false,
  email: '',
  password: '',
};

describe('DURATION_OPTIONS: все длительности делят час без остатка', () => {
  it('опции = {5, 10, 15, 20, 30} и 60 % value === 0 для каждой', () => {
    expect(DURATION_OPTIONS.map((option) => option.value)).toEqual([5, 10, 15, 20, 30]);
    for (const option of DURATION_OPTIONS) {
      expect(60 % option.value).toBe(0);
    }
  });
});

describe('validateDoctorForm: допустимые и недопустимые длительности (3.2)', () => {
  it('все опции из списка проходят (период 540 делится на каждую)', () => {
    for (const durationMinutes of [5, 10, 15, 20, 30]) {
      expect(validateDoctorForm({ ...base, durationMinutes })).toEqual({});
    }
  });

  it('вне списка -> ошибка на поле', () => {
    const message = 'Длительность: 5, 10, 15, 20 или 30 минут';
    expect(validateDoctorForm({ ...base, durationMinutes: 4 })['schedule.durationMinutes']).toBe(
      message,
    );
    expect(validateDoctorForm({ ...base, durationMinutes: 45 })['schedule.durationMinutes']).toBe(
      message,
    );
    expect(validateDoctorForm({ ...base, durationMinutes: 120 })['schedule.durationMinutes']).toBe(
      message,
    );
  });

  it('период не кратен длительности -> ошибка на поле (проверка действует)', () => {
    // 09:00–18:15 = 555 мин; 555 % 30 != 0
    const errors = validateDoctorForm({ ...base, endTime: '18:15', durationMinutes: 30 });
    expect(errors['schedule.durationMinutes']).toBe(
      'Рабочий период должен быть кратен длительности приёма',
    );
  });
});

describe('schedulePreview: превью при новых правилах', () => {
  it('превью считается для всех допустимых длительностей', () => {
    // 540 мин: /5 = 108, /15 = 36, /30 = 18 — целые окна
    expect(schedulePreview({ ...base, durationMinutes: 5 })?.perDay).toBe(108);
    expect(schedulePreview({ ...base, durationMinutes: 15 })?.perDay).toBe(36);
    expect(schedulePreview({ ...base, durationMinutes: 30 })?.perDay).toBe(18);
  });

  it('окна идут с шагом длительности', () => {
    const preview = schedulePreview({ ...base, durationMinutes: 20 });
    expect(preview!.times).toEqual(['09:00', '09:20', '09:40', '10:00', '10:20', '10:40']);
    expect(preview!.perDay).toBe(27); // 540 / 20
  });

  it('превью отсутствует при невалидном расписании', () => {
    expect(schedulePreview({ ...base, startTime: '18:00', endTime: '09:00' })).toBeNull();
    expect(schedulePreview({ ...base, workDays: [] })).toBeNull();
    // период не кратен длительности
    expect(schedulePreview({ ...base, endTime: '18:15', durationMinutes: 30 })).toBeNull();
    // длительность вне списка
    expect(schedulePreview({ ...base, durationMinutes: 45 })).toBeNull();
  });
});
