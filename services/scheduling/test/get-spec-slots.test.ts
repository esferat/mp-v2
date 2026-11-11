import { describe, expect, it, vi } from 'vitest';
import { getSpecSlots } from '../src/features/get-spec-slots';
import { makeSchedulingContext } from './helpers/in-memory';

/** Копия врача для специализации sp-1 (вт 2026-11-03 — рабочий день). */
async function seedCopy(context: ReturnType<typeof makeSchedulingContext>) {
  await context.copies.applyDoctorEvent({
    doctorId: 'doc-1',
    specializationId: 'sp-1',
    specializationName: 'Хирург',
    lastName: 'Петров',
    firstName: 'Иван',
    status: 'ACTIVE',
    schedule: {
      startTime: '09:00',
      endTime: '12:00',
      durationMinutes: 30,
      workDays: [1, 2, 3, 4, 5],
    },
    occurredAt: '2026-11-01T00:00:00.000Z',
  });
}

const query = { specId: 'sp-1', from: '2026-11-03', to: '2026-11-03' };

describe('getSpecSlots (5.2)', () => {
  it('считает свободные окна из копий, минус занятые', async () => {
    const context = makeSchedulingContext();
    await seedCopy(context);
    await context.appointments.create({
      doctorId: 'doc-1',
      doctorName: 'Петров Иван',
      specializationId: 'sp-1',
      specializationName: 'Хирург',
      patientId: 'pt-1',
      patientName: 'Пациент Один',
      startTime: '10:00',
      endTime: '10:30',
      localDate: '2026-11-03',
    });

    const slots = await getSpecSlots(
      { copies: context.copies, appointments: context.appointments },
      query,
    );

    expect(slots).toHaveLength(5); // 6 окон дня минус одно занятое
    expect(slots.some((slot) => slot.start === '10:00')).toBe(false);
    expect(slots[0]).toMatchObject({ doctorId: 'doc-1', localDate: '2026-11-03' });
  });

  it('INACTIVE врач не даёт слотов (AC 5.1)', async () => {
    const context = makeSchedulingContext();
    await seedCopy(context);
    await context.copies.applyDoctorEvent({
      doctorId: 'doc-1',
      specializationId: 'sp-1',
      specializationName: 'Хирург',
      lastName: 'Петров',
      firstName: 'Иван',
      status: 'INACTIVE',
      schedule: { startTime: '09:00', endTime: '12:00', durationMinutes: 30, workDays: [1] },
      occurredAt: '2026-11-01T00:00:00.000Z',
    });

    const slots = await getSpecSlots(
      { copies: context.copies, appointments: context.appointments },
      query,
    );
    expect(slots).toHaveLength(0);
  });

  it('fallback: пустой read-model → синхронный импорт из catalog с логом (3.5)', async () => {
    const context = makeSchedulingContext();
    const log = { warn: vi.fn() };
    const catalog = {
      listDoctors: async () => [
        {
          id: 'doc-7',
          firstName: 'Анна',
          lastName: 'Смирнова',
          specializationId: 'sp-1',
          specializationName: 'Хирург',
          status: 'ACTIVE' as const,
          schedule: { startTime: '09:00', endTime: '10:00', durationMinutes: 30, workDays: [2] },
        },
      ],
    };

    const slots = await getSpecSlots(
      { copies: context.copies, appointments: context.appointments, catalog, log },
      query,
    );

    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(slots).toHaveLength(2);
    expect(slots[0]?.doctorId).toBe('doc-7');
  });

  it('слишком длинный период → 400', async () => {
    const context = makeSchedulingContext();
    await expect(
      getSpecSlots(
        { copies: context.copies, appointments: context.appointments },
        { specId: 'sp-1', from: '2026-01-01', to: '2027-01-01' },
      ),
    ).rejects.toMatchObject({ status: 400, field: 'to' });
  });

  it('includeBusy=1: занятые слоты возвращаются с available=false (сетка «зелёные/серые»)', async () => {
    const context = makeSchedulingContext();
    await seedCopy(context);
    await context.appointments.create({
      doctorId: 'doc-1',
      doctorName: 'Петров Иван',
      specializationId: 'sp-1',
      specializationName: 'Хирург',
      patientId: 'pt-1',
      patientName: 'Пациент Один',
      startTime: '10:00',
      endTime: '10:30',
      localDate: '2026-11-03',
    });

    const all = await getSpecSlots(
      { copies: context.copies, appointments: context.appointments },
      { ...query, includeBusy: '1' },
    );

    expect(all).toHaveLength(6); // все окна дня, включая занятое
    expect(all.every((slot) => slot.available)).toBe(false);
    const busySlot = all.find((slot) => slot.start === '10:00');
    expect(busySlot?.available).toBe(false);
    expect(all.filter((slot) => slot.available)).toHaveLength(5);
  });

  it('без includeBusy — только свободные, все с available=true (обратная совместимость)', async () => {
    const context = makeSchedulingContext();
    await seedCopy(context);
    await context.appointments.create({
      doctorId: 'doc-1',
      doctorName: 'Петров Иван',
      specializationId: 'sp-1',
      specializationName: 'Хирург',
      patientId: 'pt-1',
      patientName: 'Пациент Один',
      startTime: '10:00',
      endTime: '10:30',
      localDate: '2026-11-03',
    });

    const free = await getSpecSlots(
      { copies: context.copies, appointments: context.appointments },
      query,
    );

    expect(free).toHaveLength(5);
    expect(free.every((slot) => slot.available)).toBe(true);
  });

  it('doctorPhotoUrl подтягивается из catalog для плиток wizard (5.2)', async () => {
    const context = makeSchedulingContext();
    await seedCopy(context);
    const catalog = {
      listDoctors: async () => [
        {
          id: 'doc-1',
          firstName: 'Иван',
          lastName: 'Петров',
          specializationId: 'sp-1',
          specializationName: 'Хирург',
          status: 'ACTIVE' as const,
          schedule: { startTime: '09:00', endTime: '12:00', durationMinutes: 30, workDays: [2] },
          photoUrl: 'http://cdn.test/doctor-photos/doc-1.jpg?sig=1',
        },
      ],
    };

    const slots = await getSpecSlots(
      { copies: context.copies, appointments: context.appointments, catalog },
      query,
    );

    expect(slots.length).toBeGreaterThan(0);
    expect(
      slots.every(
        (slot) => slot.doctorPhotoUrl === 'http://cdn.test/doctor-photos/doc-1.jpg?sig=1',
      ),
    ).toBe(true);
  });

  it('catalog недоступен → слоты без фото, без падения', async () => {
    const context = makeSchedulingContext();
    await seedCopy(context);
    const catalog = {
      listDoctors: async (): Promise<never[]> => {
        throw new Error('catalog down');
      },
    };

    const slots = await getSpecSlots(
      { copies: context.copies, appointments: context.appointments, catalog },
      query,
    );

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((slot) => slot.doctorPhotoUrl === undefined)).toBe(true);
  });
});
