import { parseEvent } from '@mp/contracts';
import type { ConsumedEvent } from '@mp/service-kit';
import type { DoctorEventData, ScheduleCopyRepository } from '../../../entities/schedule-copy';

/**
 * Применение события doctor.*.v1 к копии расписания (5.1): конверт
 * проверяется Zod (parseEvent бросает при расхождении → сообщение уходит
 * в DLQ, а не портит данные), идемпотентность — на уровне репозитория
 * (условный апсерт по occurredAt).
 */
export async function applyDoctorEvent(
  repository: ScheduleCopyRepository,
  event: ConsumedEvent,
): Promise<{ applied: boolean }> {
  const envelope = parseEvent(event.routingKey as Parameters<typeof parseEvent>[0], event.body) as {
    eventId: string;
    occurredAt: string;
    payload: {
      doctorId: string;
      status: string;
      userId?: string | null;
      firstName: string;
      lastName: string;
      middleName?: string;
      specializationId: string;
      specializationName: string;
      schedule: DoctorEventData['schedule'];
    };
  };

  const data: DoctorEventData = {
    doctorId: envelope.payload.doctorId,
    userId: envelope.payload.userId ?? null,
    specializationId: envelope.payload.specializationId,
    specializationName: envelope.payload.specializationName,
    lastName: envelope.payload.lastName,
    firstName: envelope.payload.firstName,
    ...(envelope.payload.middleName ? { middleName: envelope.payload.middleName } : {}),
    status: envelope.payload.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    schedule: envelope.payload.schedule,
    occurredAt: envelope.occurredAt,
  };

  return repository.applyDoctorEvent(data);
}
