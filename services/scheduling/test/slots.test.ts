import { describe, expect, it } from 'vitest';
import {
  busyKey,
  computeSlots,
  formatMinutes,
  isoDayOfWeek,
  iterateDates,
  toMinutes,
} from '../src/entities/slots';

const doctor = {
  doctorId: 'doc-1',
  doctorName: 'Петров Иван',
  startTime: '09:00',
  endTime: '12:00',
  durationMinutes: 30,
  workDays: [1, 2, 3, 4, 5], // пн-пт
};

describe('toMinutes/formatMinutes/isoDayOfWeek', () => {
  it('переводит время туда и обратно', () => {
    expect(toMinutes('09:30')).toBe(570);
    expect(formatMinutes(570)).toBe('09:30');
    expect(toMinutes('9:00')).toBeNull();
  });

  it('считает дни недели 1=пн … 7=вс (ISO)', () => {
    expect(isoDayOfWeek('2026-11-02')).toBe(1); // понедельник
    expect(isoDayOfWeek('2026-11-08')).toBe(7); // воскресенье
    expect(isoDayOfWeek('2026-11-07')).toBe(6); // суббота
  });

  it('перебирает даты включительно', () => {
    expect([...iterateDates('2026-11-01', '2026-11-03')]).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ]);
  });
});

describe('computeSlots (5.2)', () => {
  // 2026-11-02 = понедельник, 2026-11-08 = воскресенье
  it('сетка окон по рабочим дням с шагом длительности', () => {
    const slots = computeSlots({
      windows: [doctor],
      from: '2026-11-02',
      to: '2026-11-08',
      busy: new Set(),
    });
    // 5 будней × 6 окон (09:00–12:00 / 30 мин)
    expect(slots).toHaveLength(5 * 6);
    expect(slots[0]).toEqual({
      localDate: '2026-11-02',
      start: '09:00',
      end: '09:30',
      doctorId: 'doc-1',
      doctorName: expect.any(String),
    });
    // выходные не попадают
    expect(slots.every((slot) => slot.localDate !== '2026-11-08')).toBe(true);
  });

  it('занятые слоты исключаются', () => {
    const busy = new Set([busyKey('doc-1', '2026-11-02', '10:00')]);
    const slots = computeSlots({ windows: [doctor], from: '2026-11-02', to: '2026-11-02', busy });
    expect(slots).toHaveLength(5);
    expect(slots.some((slot) => slot.start === '10:00')).toBe(false);
  });

  it('фильтры startTime/endTime сужают окно', () => {
    const slots = computeSlots({
      windows: [doctor],
      from: '2026-11-02',
      to: '2026-11-02',
      busy: new Set(),
      startTime: '10:00',
      endTime: '11:00',
    });
    expect(slots.map((slot) => slot.start)).toEqual(['10:00', '10:30']);
  });

  it('окно врача не кратно шагу? шаг от начала окна: сетка не выходит за конец', () => {
    const slots = computeSlots({
      windows: [{ ...doctor, endTime: '11:20' }],
      from: '2026-11-02',
      to: '2026-11-02',
      busy: new Set(),
    });
    // 09:00..11:20: последнее окно 10:30–11:00 (11:00+30 > 11:20)
    expect(slots.map((slot) => slot.start)).toEqual(['09:00', '09:30', '10:00', '10:30']);
  });
});
