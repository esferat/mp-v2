import { describe, expect, it } from 'vitest';
import { RoutingKeys } from '@mp/contracts';
import { rescheduleAppointment } from '../src/features/reschedule-appointment';
import { fixedNow, makeSchedulingContext } from './helpers/in-memory';

/** «Сейчас»: 10.11.2026 09:00 UTC — все будущие даты в тестах позже. */
const NOW = '2026-11-10T09:00:00.000Z';

async function seed() {
  const context = makeSchedulingContext();
  // Копии расписания двух врачей (ACTIVE, ежедневно 09:00–18:00, 30 мин)
  for (const doctor of [
    { doctorId: 'doc-1', lastName: 'Петров', firstName: 'Иван' },
    { doctorId: 'doc-2', lastName: 'Сидорова', firstName: 'Елена' },
  ]) {
    await context.copies.applyDoctorEvent({
      ...doctor,
      specializationId: 'sp-1',
      specializationName: 'Хирург',
      status: 'ACTIVE',
      schedule: {
        startTime: '09:00',
        endTime: '18:00',
        durationMinutes: 30,
        workDays: [1, 2, 3, 4, 5, 6, 7],
      },
      occurredAt: '2026-11-01T00:00:00.000Z',
    });
  }

  const appointment = await context.appointments.create({
    doctorId: 'doc-1',
    doctorName: 'Петров Иван',
    specializationId: 'sp-1',
    specializationName: 'Хирург',
    patientId: 'pt-1',
    patientName: 'Иванова Ольга',
    startTime: '10:00',
    endTime: '10:30',
    localDate: '2026-11-12',
  });

  return { context, appointment };
}

function deps(context: Awaited<ReturnType<typeof seed>>['context']) {
  return { unitOfWork: context.unitOfWork, copies: context.copies, now: fixedNow(NOW) };
}

const ADMIN = { sub: 'admin-sub', roles: ['ADMIN'] as const };

/** Перенос записи (10.3, Этап 2.1). */
describe('rescheduleAppointment (10.3)', () => {
  it('перенос на будущий слот: статус сохраняется, журнал и событие уходят', async () => {
    const { context, appointment } = await seed();

    const updated = await rescheduleAppointment(deps(context), {
      id: appointment.id,
      request: {
        localDate: '2026-11-13',
        start: '11:00',
        reason: 'Пациент попросил перенести',
      },
      subject: ADMIN,
    });

    // Статус НЕ меняется (канон §1: SUBMITTED → SUBMITTED)
    expect(updated.status).toBe('SUBMITTED');
    expect(updated.slot.localDate).toBe('2026-11-13');
    expect(updated.slot.start).toBe('11:00');
    // Конец окна = начало + длительность расписания врача (30 мин)
    expect(updated.slot.end).toBe('11:30');

    // Журнал переносов (10.3): старый/новый слот, инициатор, причина
    expect(context.appointments.rescheduleLogs).toHaveLength(1);
    expect(context.appointments.rescheduleLogs[0]).toMatchObject({
      appointmentId: appointment.id,
      previousStatus: 'SUBMITTED',
      changedBy: 'admin-sub',
      old: { doctorId: 'doc-1', localDate: '2026-11-12', start: '10:00', end: '10:30' },
      newLocalDate: '2026-11-13',
      newStart: '11:00',
      reason: 'Пациент попросил перенести',
    });

    // Событие через outbox: старый/новый слот для будущей проекции отчёта
    expect(context.outbox.events).toHaveLength(1);
    expect(context.outbox.events[0]?.routingKey).toBe(RoutingKeys.AppointmentRescheduled);
    expect(context.outbox.events[0]?.payload).toMatchObject({
      payload: {
        appointmentId: appointment.id,
        patientId: 'pt-1',
        previousStatus: 'SUBMITTED',
        old: { doctorId: 'doc-1', slot: { localDate: '2026-11-12', start: '10:00', end: '10:30' } },
        new: { doctorId: 'doc-1', slot: { localDate: '2026-11-13', start: '11:00', end: '11:30' } },
        reason: 'Пациент попросил перенести',
      },
    });
  });

  it('смена врача: снапшот врача и специализации обновляется', async () => {
    const { context, appointment } = await seed();

    const updated = await rescheduleAppointment(deps(context), {
      id: appointment.id,
      request: { doctorId: 'doc-2', localDate: '2026-11-14', start: '12:00' },
      subject: ADMIN,
    });

    expect(updated.doctorId).toBe('doc-2');
    expect(updated.doctorName).toBe('Сидорова Елена');
    expect(updated.specializationName).toBe('Хирург');
    expect(context.appointments.rescheduleLogs[0]?.old.doctorId).toBe('doc-1');
  });

  it('только ADMIN: DOCTOR → 403 (защита в глубину, 10.3 AC)', async () => {
    const { context, appointment } = await seed();

    await expect(
      rescheduleAppointment(deps(context), {
        id: appointment.id,
        request: { localDate: '2026-11-13', start: '11:00' },
        subject: { sub: 'doctor-sub', roles: ['DOCTOR'] },
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(context.appointments.rescheduleLogs).toHaveLength(0);
    expect(context.outbox.events).toHaveLength(0);
  });

  it('из CANCELLED → 409, без журнала и события', async () => {
    const { context, appointment } = await seed();
    await context.appointments.updateStatus(appointment.id, 'CANCELLED');

    await expect(
      rescheduleAppointment(deps(context), {
        id: appointment.id,
        request: { localDate: '2026-11-13', start: '11:00' },
        subject: ADMIN,
      }),
    ).rejects.toMatchObject({ status: 409 });

    expect(context.appointments.rescheduleLogs).toHaveLength(0);
    expect(context.outbox.events).toHaveLength(0);
  });

  it('перенос на прошедшее → 409 (AC 10.3)', async () => {
    const { context, appointment } = await seed();

    await expect(
      rescheduleAppointment(deps(context), {
        id: appointment.id,
        request: { localDate: '2026-11-09', start: '10:00' },
        subject: ADMIN,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('занятый слот → 409 SLOT_TAKEN, запись не изменилась', async () => {
    const { context, appointment } = await seed();
    // чужая запись уже занимает целевой слот
    await context.appointments.create({
      doctorId: 'doc-1',
      doctorName: 'Петров Иван',
      specializationId: 'sp-1',
      specializationName: 'Хирург',
      patientId: 'pt-2',
      patientName: 'Другой Пациент',
      startTime: '11:00',
      endTime: '11:30',
      localDate: '2026-11-13',
    });

    await expect(
      rescheduleAppointment(deps(context), {
        id: appointment.id,
        request: { localDate: '2026-11-13', start: '11:00' },
        subject: ADMIN,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'SLOT_TAKEN' });

    const unchanged = await context.appointments.findById(appointment.id);
    expect(unchanged?.localDate).toBe('2026-11-12');
    expect(context.appointments.rescheduleLogs).toHaveLength(0);
  });

  it('идемпотентный повтор: тот же врач/дата/время → 200 без событий и журнала', async () => {
    const { context, appointment } = await seed();

    const again = await rescheduleAppointment(deps(context), {
      id: appointment.id,
      request: { localDate: '2026-11-12', start: '10:00' },
      subject: ADMIN,
    });

    expect(again.slot.localDate).toBe('2026-11-12');
    expect(again.slot.start).toBe('10:00');
    expect(context.appointments.rescheduleLogs).toHaveLength(0);
    expect(context.outbox.events).toHaveLength(0);
  });

  it('время вне окна врача → 400 с полем (не 409)', async () => {
    const { context, appointment } = await seed();

    await expect(
      rescheduleAppointment(deps(context), {
        id: appointment.id,
        request: { localDate: '2026-11-13', start: '20:00' },
        subject: ADMIN,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('неизвестная запись → 404', async () => {
    const { context } = await seed();
    await expect(
      rescheduleAppointment(deps(context), {
        id: 'nope',
        request: { localDate: '2026-11-13', start: '11:00' },
        subject: ADMIN,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
