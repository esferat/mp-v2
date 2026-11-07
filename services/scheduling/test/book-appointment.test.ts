import { describe, expect, it } from 'vitest';
import { RoutingKeys } from '@mp/contracts';
import { bookAppointment } from '../src/features/book-appointment';
import { fixedNow, makeSchedulingContext } from './helpers/in-memory';

/** 2026-11-03 — вторник (рабочий день по workDays [1..5]). */
const NOW = '2026-11-01T08:00:00.000Z';

async function seed() {
  const context = makeSchedulingContext();
  await context.copies.applyDoctorEvent({
    doctorId: 'doc-1',
    specializationId: 'sp-1',
    specializationName: 'Хирург',
    lastName: 'Петров',
    firstName: 'Иван',
    status: 'ACTIVE',
    schedule: {
      startTime: '09:00',
      endTime: '18:00',
      durationMinutes: 30,
      workDays: [1, 2, 3, 4, 5],
    },
    occurredAt: '2026-11-01T00:00:00.000Z',
  });
  context.patients.add({
    id: 'pt-1',
    userId: 'user-1',
    email: 'p@test.mp',
    firstName: 'Ольга',
    lastName: 'Иванова',
    birthDate: '1990-01-01',
    registeredAt: '2026-01-01T00:00:00.000Z',
  });
  return context;
}

const base = {
  request: {
    doctorId: 'doc-1',
    slot: { localDate: '2026-11-03', start: '10:00' },
  },
  subjectSub: 'user-1',
  subjectRoles: ['USER'],
};

describe('bookAppointment (5.3)', () => {
  it('успешное бронирование: снапшоты ФИО, событие appointment.submitted.v1', async () => {
    const context = await seed();
    const deps = {
      copies: context.copies,
      unitOfWork: context.unitOfWork,
      patients: context.patients,
      now: fixedNow(NOW),
    };

    const appointment = await bookAppointment(deps, base);

    expect(appointment).toMatchObject({
      status: 'SUBMITTED',
      patientId: 'pt-1',
      patientName: 'Иванова Ольга',
      doctorName: 'Петров Иван',
      specializationName: 'Хирург',
      slot: { localDate: '2026-11-03', start: '10:00', end: '10:30' },
    });

    expect(context.outbox.events).toHaveLength(1);
    expect(context.outbox.events[0]?.routingKey).toBe(RoutingKeys.AppointmentSubmitted);
    expect(context.outbox.events[0]?.payload).toMatchObject({
      payload: {
        appointmentId: appointment.id,
        patientName: 'Иванова Ольга',
        slot: { localDate: '2026-11-03', start: '10:00', end: '10:30' },
      },
    });
  });

  it('дубль слота → 409 SLOT_TAKEN (AC 5.3: второй запрос проигрывает)', async () => {
    const context = await seed();
    const deps = {
      copies: context.copies,
      unitOfWork: context.unitOfWork,
      patients: context.patients,
      now: fixedNow(NOW),
    };

    await bookAppointment(deps, base);
    await expect(bookAppointment(deps, base)).rejects.toMatchObject({
      status: 409,
      code: 'SLOT_TAKEN',
    });
    expect(context.appointments.rows.size).toBe(1);
  });

  it('врач не в копии / неактивен → 400 doctorId', async () => {
    const context = await seed();
    const deps = {
      copies: context.copies,
      unitOfWork: context.unitOfWork,
      patients: context.patients,
      now: fixedNow(NOW),
    };

    await expect(
      bookAppointment(deps, { ...base, request: { ...base.request, doctorId: 'nope' } }),
    ).rejects.toMatchObject({ status: 400, field: 'doctorId' });
  });

  it('дата в прошлом / выходной / вне окна → 400 на поле слота', async () => {
    const context = await seed();
    const deps = {
      copies: context.copies,
      unitOfWork: context.unitOfWork,
      patients: context.patients,
      now: fixedNow(NOW),
    };

    await expect(
      bookAppointment(deps, {
        ...base,
        request: { ...base.request, slot: { localDate: '2026-10-01', start: '10:00' } },
      }),
    ).rejects.toMatchObject({ status: 400, field: 'slot.localDate' });

    await expect(
      bookAppointment(deps, {
        ...base,
        request: { ...base.request, slot: { localDate: '2026-11-08', start: '10:00' } },
      }),
    ).rejects.toMatchObject({ status: 400, field: 'slot.localDate' });

    await expect(
      bookAppointment(deps, {
        ...base,
        request: { ...base.request, slot: { localDate: '2026-11-03', start: '10:15' } },
      }),
    ).rejects.toMatchObject({ status: 400, field: 'slot.start' });
  });

  it('сегодняшний слот уже прошёл → 400', async () => {
    const context = await seed();
    // NOW = 08:00 UTC; слот в 09:00 того же дня проходит, 08:30 — нет? 08:30 < 09:00
    const deps = {
      copies: context.copies,
      unitOfWork: context.unitOfWork,
      patients: context.patients,
      now: fixedNow('2026-11-03T09:30:00.000Z'), // после 09:00-09:30
    };

    await expect(
      bookAppointment(deps, {
        ...base,
        request: { ...base.request, slot: { localDate: '2026-11-03', start: '09:00' } },
      }),
    ).rejects.toMatchObject({ status: 400, field: 'slot.start' });
  });

  it('ADMIN бронирует по явному patientId; без карточки → 400', async () => {
    const context = await seed();
    const deps = {
      copies: context.copies,
      unitOfWork: context.unitOfWork,
      patients: context.patients,
      now: fixedNow(NOW),
    };

    const appointment = await bookAppointment(deps, {
      ...base,
      subjectSub: 'admin-1',
      subjectRoles: ['ADMIN'],
      request: { ...base.request, patientId: 'pt-1' },
    });
    expect(appointment.patientId).toBe('pt-1');

    await expect(
      bookAppointment(deps, {
        ...base,
        subjectSub: 'user-unknown',
        subjectRoles: ['USER'],
      }),
    ).rejects.toMatchObject({ status: 400, field: 'patientId' });
  });
});
