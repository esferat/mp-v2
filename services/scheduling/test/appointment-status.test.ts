import { describe, expect, it } from 'vitest';
import { RoutingKeys } from '@mp/contracts';
import { canTransition } from '../src/entities/appointment';
import { cancelAppointment } from '../src/features/cancel-appointment';
import { getMyAppointments } from '../src/features/get-my-appointments';
import { setAppointmentStatus } from '../src/features/set-appointment-status';
import { makeSchedulingContext } from './helpers/in-memory';

async function seedAppointment() {
  const context = makeSchedulingContext();
  context.patients.add({
    id: 'pt-1',
    userId: 'user-1',
    email: 'p@test.mp',
    firstName: 'Ольга',
    lastName: 'Иванова',
    birthDate: '1990-01-01',
    registeredAt: '2026-01-01T00:00:00.000Z',
  });
  const appointment = await context.appointments.create({
    doctorId: 'doc-1',
    doctorName: 'Петров Иван',
    specializationId: 'sp-1',
    specializationName: 'Хирург',
    patientId: 'pt-1',
    patientName: 'Иванова Ольга',
    startTime: '10:00',
    endTime: '10:30',
    localDate: '2026-11-03',
  });
  return { context, appointment };
}

describe('канон статусной машины (§1)', () => {
  it('разрешённые переходы', () => {
    expect(canTransition('SUBMITTED', 'APPROVED')).toBe(true);
    expect(canTransition('SUBMITTED', 'DECLINED')).toBe(true);
    expect(canTransition('SUBMITTED', 'CANCELLED')).toBe(true);
    expect(canTransition('APPROVED', 'CANCELLED')).toBe(true);
    expect(canTransition('APPROVED', 'COMPLETED')).toBe(true);
  });

  it('запрещённые переходы (терминальные статусы и мимо SUBMITTED)', () => {
    expect(canTransition('SUBMITTED', 'COMPLETED')).toBe(false);
    expect(canTransition('DECLINED', 'APPROVED')).toBe(false);
    expect(canTransition('CANCELLED', 'APPROVED')).toBe(false);
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
    expect(canTransition('APPROVED', 'DECLINED')).toBe(false);
    // идемпотентного «повтора approve» нет: повтор → 409 (зафиксировано в 5.4)
    expect(canTransition('APPROVED', 'APPROVED')).toBe(false);
  });
});

describe('setAppointmentStatus (5.4)', () => {
  it('APPROVED из SUBMITTED: статус + событие appointment.approved.v1', async () => {
    const { context, appointment } = await seedAppointment();

    const updated = await setAppointmentStatus(context.unitOfWork, appointment.id, {
      status: 'APPROVED',
    });

    expect(updated.status).toBe('APPROVED');
    expect(context.outbox.events[0]?.routingKey).toBe(RoutingKeys.AppointmentApproved);
  });

  it('DECLINED без причины → 400; с причиной → событие с reason', async () => {
    const { context, appointment } = await seedAppointment();

    await expect(
      setAppointmentStatus(context.unitOfWork, appointment.id, { status: 'DECLINED' }),
    ).rejects.toMatchObject({ status: 400, field: 'reason' });

    const declined = await setAppointmentStatus(context.unitOfWork, appointment.id, {
      status: 'DECLINED',
      reason: 'Врач на смене',
    });
    expect(declined.declineReason).toBe('Врач на смене');
    expect(context.outbox.events[0]?.payload).toMatchObject({
      payload: { reason: 'Врач на смене' },
    });
  });

  it('недопустимый переход → 409, БД не изменилась (AC)', async () => {
    const { context, appointment } = await seedAppointment();
    // допустимый переход, чтобы попасть в APPOVED
    await setAppointmentStatus(context.unitOfWork, appointment.id, { status: 'APPROVED' });
    const eventsBefore = context.outbox.events.length;

    // повтор approve (двойной клик) → 409 без эффектов
    await expect(
      setAppointmentStatus(context.unitOfWork, appointment.id, { status: 'APPROVED' }),
    ).rejects.toMatchObject({ status: 409, code: 'INVALID_TRANSITION' });

    expect((await context.appointments.findById(appointment.id))?.status).toBe('APPROVED');
    expect(context.outbox.events).toHaveLength(eventsBefore);
  });

  it('неизвестная запись → 404', async () => {
    const { context } = await seedAppointment();
    await expect(
      setAppointmentStatus(context.unitOfWork, 'nope', { status: 'APPROVED' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('cancelAppointment (5.4)', () => {
  it('отмена из SUBMITTED: previousStatus в событии', async () => {
    const { context, appointment } = await seedAppointment();

    const cancelled = await cancelAppointment(context.unitOfWork, appointment.id, {});

    expect(cancelled.status).toBe('CANCELLED');
    expect(context.outbox.events[0]?.routingKey).toBe(RoutingKeys.AppointmentCancelled);
    expect(context.outbox.events[0]?.payload).toMatchObject({
      payload: { appointmentId: appointment.id, previousStatus: 'SUBMITTED' },
    });
  });

  it('CANCELLED → терминал: повторная отмена 409', async () => {
    const { context, appointment } = await seedAppointment();
    await cancelAppointment(context.unitOfWork, appointment.id, {});

    await expect(cancelAppointment(context.unitOfWork, appointment.id, {})).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe('getMyAppointments (5.5: только своя история)', () => {
  it('видит записи своей карточки; чужой sub — свои (не чужие)', async () => {
    const { context } = await seedAppointment();
    context.patients.add({
      id: 'pt-2',
      userId: 'user-2',
      email: 'other@test.mp',
      firstName: 'Чужой',
      lastName: 'Пациент',
      birthDate: '1991-01-01',
      registeredAt: '2026-01-01T00:00:00.000Z',
    });

    const mine = await getMyAppointments(
      { appointments: context.appointments, patients: context.patients },
      'user-1',
      { offset: 0, limit: 10 },
    );
    expect(mine.total).toBe(1);
    expect(mine.items[0]?.patientId).toBe('pt-1');

    const other = await getMyAppointments(
      { appointments: context.appointments, patients: context.patients },
      'user-2',
      { offset: 0, limit: 10 },
    );
    expect(other.total).toBe(0);
  });

  it('пользователь без карточки получает пустую историю', async () => {
    const { context } = await seedAppointment();
    const result = await getMyAppointments(
      { appointments: context.appointments, patients: context.patients },
      'user-unknown',
      { offset: 0, limit: 10 },
    );
    expect(result).toEqual({ items: [], total: 0 });
  });
});
