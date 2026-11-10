import { describe, expect, it } from 'vitest';
import {
  applyDoctorEvent,
  type DoctorEventEnvelope,
} from '../src/features/schedule-copy-sync/app/apply-doctor-event';
import { importCopiesFromCatalog } from '../src/entities/schedule-copy';
import { makeSchedulingContext } from './helpers/in-memory';

function doctorEvent(overrides: {
  eventId?: string;
  occurredAt: string;
  payload?: Partial<{
    doctorId: string;
    status: string;
    firstName: string;
    lastName: string;
    specializationId: string;
    specializationName: string;
    schedule: { startTime: string; endTime: string; durationMinutes: number; workDays: number[] };
  }>;
}): DoctorEventEnvelope {
  const payload = {
    doctorId: 'doc-1',
    status: 'ACTIVE',
    firstName: 'Иван',
    lastName: 'Петров',
    specializationId: 'sp-1',
    specializationName: 'Хирург',
    schedule: {
      startTime: '09:00',
      endTime: '18:00',
      durationMinutes: 30,
      workDays: [1, 2, 3, 4, 5],
    },
    ...overrides.payload,
  };
  return {
    eventId: overrides.eventId ?? '00000000-0000-4000-8000-000000000001',
    occurredAt: overrides.occurredAt,
    payload,
  };
}

describe('applyDoctorEvent (5.1: потребитель doctor.*)', () => {
  it('применяет событие: копия создаётся с данными врача', async () => {
    const { copies } = makeSchedulingContext();

    const result = await applyDoctorEvent(
      copies,
      doctorEvent({ occurredAt: '2026-11-01T10:00:00.000Z' }),
    );

    expect(result.applied).toBe(true);
    const copy = await copies.findById('doc-1');
    expect(copy).toMatchObject({
      specializationName: 'Хирург',
      lastName: 'Петров',
      status: 'ACTIVE',
      startTime: '09:00',
      durationMinutes: 30,
    });
  });

  it('повтор того же события идемпотентен (AC 3.5)', async () => {
    const { copies } = makeSchedulingContext();
    const event = doctorEvent({ occurredAt: '2026-11-01T10:00:00.000Z' });

    const first = await applyDoctorEvent(copies, event);
    const second = await applyDoctorEvent(copies, event);

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(true); // равный sourceAt допустим (нет отката)
    expect(await copies.count()).toBe(1);
  });

  it('более СТАРОЕ событие не перезаписывает свежую копию (гонка порядка)', async () => {
    const { copies } = makeSchedulingContext();

    await applyDoctorEvent(copies, doctorEvent({ occurredAt: '2026-11-02T10:00:00.000Z' }));
    const stale = await applyDoctorEvent(
      copies,
      doctorEvent({
        occurredAt: '2026-11-01T10:00:00.000Z',
        payload: { lastName: 'Старый' },
      }),
    );

    expect(stale.applied).toBe(false);
    expect((await copies.findById('doc-1'))?.lastName).toBe('Петров');
  });

  it('INACTIVE из события попадает в копию (архив не даёт слотов)', async () => {
    const { copies } = makeSchedulingContext();
    await applyDoctorEvent(
      copies,
      doctorEvent({ occurredAt: '2026-11-01T10:00:00.000Z', payload: { status: 'INACTIVE' } }),
    );
    expect((await copies.findById('doc-1'))?.status).toBe('INACTIVE');
  });
});

describe('importCopiesFromCatalog (5.1 bootstrap)', () => {
  it('импортирует список врачей с occurredAt = epoch (события новее)', async () => {
    const { copies } = makeSchedulingContext();
    const catalog = {
      listDoctors: async () => [
        {
          id: 'doc-9',
          firstName: 'Анна',
          lastName: 'Смирнова',
          specializationId: 'sp-2',
          specializationName: 'Кардиолог',
          status: 'ACTIVE' as const,
          schedule: { startTime: '10:00', endTime: '16:00', durationMinutes: 20, workDays: [1] },
        },
      ],
    };

    const result = await importCopiesFromCatalog(copies, catalog);

    expect(result.imported).toBe(1);
    const copy = await copies.findById('doc-9');
    expect(copy).toMatchObject({ lastName: 'Смирнова', sourceAt: '1970-01-01T00:00:00.000Z' });

    // Событие из catalog (более свежее) применяется поверх импорта
    const applied = await applyDoctorEvent(
      copies,
      doctorEvent({
        occurredAt: '2026-11-01T10:00:00.000Z',
        payload: { doctorId: 'doc-9', lastName: 'Новая' },
      }),
    );
    expect(applied.applied).toBe(true);
    expect((await copies.findById('doc-9'))?.lastName).toBe('Новая');
  });
});
