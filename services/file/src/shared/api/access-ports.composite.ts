import type { AccessPorts } from '../../entities/access';
import type { PatientHttpClient } from './patient.http.client';
import type { SchedulingHttpClient } from './scheduling.http.client';

/**
 * Композит портов прав (9.3): checkFileAccess получает ЕДИН объект,
 * объединяющий patient-клиент (карточка владельца) и scheduling-клиент
 * (связь «врач-пациент», привязка sub → doctorId). Композит знаёт только
 * о трёх методах порта — сервисные клиенты скрыты за ними (hexagonal).
 */
export class AccessPortsComposite implements AccessPorts {
  constructor(
    private readonly patient: PatientHttpClient,
    private readonly scheduling: SchedulingHttpClient,
  ) {}

  findPatientByUser(userId: string): Promise<{ id: string } | null> {
    return this.patient.findPatientByUser(userId);
  }

  hasDoctorRelation(doctorUserId: string, patientId: string): Promise<boolean> {
    return this.scheduling.hasDoctorRelation(doctorUserId, patientId);
  }

  findDoctorByUser(userId: string): Promise<{ id: string } | null> {
    return this.scheduling.findDoctorByUser(userId);
  }
}
