import { parseEvent } from '@mp/contracts';
import type { AppointmentRepository } from '../../../entities/appointment';

/**
 * Денализация ФИО пациента в записях (4.6: consumer patient.created/updated.v1).
 *
 * ПРАВИЛО (фиксируется здесь и в architecture §5): списки и история
 * отражают ТЕКУЩЕЕ ФИО пациента — все записи пациента обновляются на новое
 * имя. Снапшоты ВРАЧА/специализации при этом не меняются (они заморожены
 * на момент записи, 3.2). Повтор события идемпотентен: имя уже новое →
 * 0 изменений; вдобавок обработку дублей гасит InboxService.
 *
 * Валидация схемы (Zod, parseEvent) выполняется ДО вызова — в общей
 * консьюмер-обёртке (service-kit/createConsumerHandler, 6.3): нарушение
 * схемы уходит в DLQ без записи в inbox и без ретраев.
 *
 * ПОРЯДОК: «последнее событие побеждает» гарантируется строгой
 * последовательностью обработки (RABBITMQ_PREFETCH=1 в scheduling —
 * иначе параллельные сообщения могут примениться в обратном порядке).
 */
export interface PatientEventEnvelope {
  occurredAt: string;
  payload: {
    patientId: string;
    firstName: string;
    lastName: string;
    middleName?: string;
  };
}

export async function applyPatientEvent(
  repository: AppointmentRepository,
  envelope: PatientEventEnvelope,
): Promise<{ updated: number }> {
  const patientName = [
    envelope.payload.lastName,
    envelope.payload.firstName,
    envelope.payload.middleName ?? '',
  ]
    .filter((part) => part.length > 0)
    .join(' ');

  const updated = await repository.updatePatientName(envelope.payload.patientId, patientName);
  return { updated };
}

/** Zod-валидация конверта события patient.* (используется потребителем). */
export function parsePatientEvent(routingKey: string, body: unknown): PatientEventEnvelope {
  return parseEvent(routingKey as Parameters<typeof parseEvent>[0], body) as PatientEventEnvelope;
}
