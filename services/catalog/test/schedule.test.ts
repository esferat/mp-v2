import { describe, expect, it } from 'vitest';
import { toMinutes, validateSchedule } from '../src/entities/schedule';
import type { DoctorSchedule } from '../src/entities/doctor';

const valid: DoctorSchedule = {
  startTime: '09:00',
  endTime: '18:00',
  durationMinutes: 30,
  workDays: [1, 2, 3, 4, 5],
};

describe('toMinutes', () => {
  it('преобразует HH:mm в минуты', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('09:30')).toBe(570);
    expect(toMinutes('23:59')).toBe(1439);
  });

  it('возвращает null для неверного формата', () => {
    expect(toMinutes('9:00')).toBeNull();
    expect(toMinutes('24:00')).toBeNull();
    expect(toMinutes('09:60')).toBeNull();
    expect(toMinutes('abc')).toBeNull();
  });
});

describe('validateSchedule (домен, 3.2)', () => {
  it('валидное расписание -> null', () => {
    expect(validateSchedule(valid)).toBeNull();
    expect(
      validateSchedule({ ...valid, startTime: '10:00', endTime: '14:30', durationMinutes: 15 }),
    ).toBeNull();
  });

  it('начало позже конца -> ошибка на schedule.startTime', () => {
    const issue = validateSchedule({ ...valid, startTime: '18:00', endTime: '09:00' });
    expect(issue).toMatchObject({ field: 'schedule.startTime' });
  });

  it('начало равно концу -> ошибка на schedule.startTime', () => {
    const issue = validateSchedule({ ...valid, startTime: '09:00', endTime: '09:00' });
    expect(issue).toMatchObject({ field: 'schedule.startTime' });
  });

  it('период не кратен длительности -> ошибка на schedule.durationMinutes (3.2)', () => {
    // 09:00–18:15 = 555 мин; 555 % 30 != 0
    const issue = validateSchedule({ ...valid, endTime: '18:15', durationMinutes: 30 });
    expect(issue).toMatchObject({
      field: 'schedule.durationMinutes',
      message: 'Рабочий период должен быть кратен длительности приёма',
    });
  });

  it('длительность вне 5-30 -> ошибка на schedule.durationMinutes', () => {
    expect(validateSchedule({ ...valid, durationMinutes: 45 })).toMatchObject({
      field: 'schedule.durationMinutes',
      message: 'Длительность: 5, 10, 15, 20 или 30 минут',
    });
    expect(validateSchedule({ ...valid, durationMinutes: 120 })).toMatchObject({
      field: 'schedule.durationMinutes',
      message: 'Длительность: 5, 10, 15, 20 или 30 минут',
    });
  });

  it('длительность не делит час -> ошибка на schedule.durationMinutes', () => {
    // 60 % 25 = 10 и 60 % 7 != 0: в часе нет целого числа приёмов
    expect(validateSchedule({ ...valid, durationMinutes: 25 })).toMatchObject({
      field: 'schedule.durationMinutes',
      message: 'Длительность должна делить час без остатка (5, 10, 15, 20 или 30 мин)',
    });
    expect(validateSchedule({ ...valid, durationMinutes: 7 })).toMatchObject({
      field: 'schedule.durationMinutes',
      message: 'Длительность должна делить час без остатка (5, 10, 15, 20 или 30 мин)',
    });
  });

  it('нет рабочих дней -> ошибка на schedule.workDays', () => {
    expect(validateSchedule({ ...valid, workDays: [] })).toMatchObject({
      field: 'schedule.workDays',
    });
  });

  it('неверный формат времени -> ошибка на schedule.startTime', () => {
    expect(validateSchedule({ ...valid, startTime: '9:00' })).toMatchObject({
      field: 'schedule.startTime',
    });
  });
});
