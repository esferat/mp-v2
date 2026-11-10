import { parseEvent } from '@mp/contracts';
import type { DoctorEventData, ScheduleCopyRepository } from '../../../entities/schedule-copy';

/**
 * Применение события doctor.*.v1 к копии расписания (5.1).
 *
 * Zod-валидация конверта выполняется ДО вызова — в общей консьюмер-обёртке
 * (service-kit/createConsumerHandler, 6.3): расхождение со схемой уходит
 * в DLQ, не портит данные и не пишется в inbox. Идемпотентность данных —
 * на уровне репозитория (условный апсерт по occurredAt).
 */
export interface DoctorEventEnvelope {
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
}

export async function applyDoctorEvent(
  repository: ScheduleCopyRepository,
  envelope: DoctorEventEnvelope,
): Promise<{ applied: boolean }> {
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

/** Zod-валидация конверта события doctor.* (используется потребителем). */
export function parseDoctorEvent(routingKey: string, body: unknown): DoctorEventEnvelope {
  return parseEvent(routingKey as Parameters<typeof parseEvent>[0], body) as DoctorEventEnvelope;
}
