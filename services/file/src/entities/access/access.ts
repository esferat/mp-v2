import type { OwnerType } from '@mp/contracts';
import type { AccessSubject } from '@mp/service-kit';

/**
 * Единый тип «кто запрашивает» (AccessSubject) живёт в service-kit —
 * им же пользуется scheduling (DRY). Здесь он ре-экспортируется,
 * чтобы потребители entities/access не тянули service-kit напрямую.
 */
export type { AccessSubject } from '@mp/service-kit';

/**
 * Единственная проверка прав на файл (4.4/4.5/9.3): одна функция для выдачи
 * presigned-ссылки, загрузки и удаления (DRY). Права врача (связь
 * «врач-пациент» по действующей записи) добавлены СЮДА, а не копируются
 * в слайсы.
 */

export interface AccessTarget {
  ownerType: OwnerType;
  /** patient.id (PATIENT) или doctor.id (DOCTOR). */
  ownerId: string;
}

export interface AccessPorts {
  /** Карточка пациента по Keycloak sub; null — карточки нет. */
  findPatientByUser(userId: string): Promise<{ id: string } | null>;

  /**
   * Связь «врач-пациент» (9.3): есть ли у врача (по sub) действующая
   * запись с пациентом (APPROVED/COMPLETED в scheduling). Реализация —
   * HTTP к scheduling (relations/check).
   */
  hasDoctorRelation(doctorUserId: string, patientId: string): Promise<boolean>;

  /**
   * Привязка sub → doctorId (9.3): решает, свои ли файлы врача запрашиваются.
   * Реализация — HTTP к scheduling (relations/doctor/:userId); null — привязки нет.
   */
  findDoctorByUser(userId: string): Promise<{ id: string } | null>;
}

export type AccessResult = { allowed: true } | { allowed: false; reason: string };

function deny(reason: string): AccessResult {
  return { allowed: false, reason };
}

/**
 * Правила доступа (4.4 AC: чужой документ не отдаётся; 9.3 AC: документы
 * пациента видит только владелец, ADMIN и врач с действующим приёмом):
 * - ADMIN — всегда;
 * - PATIENT-владелец + роль USER — только своя карточка (ownerId = patient.id);
 * - DOCTOR + PATIENT-файл — только при наличии связи (APPROVED/COMPLETED);
 * - DOCTOR + DOCTOR-файл — только свои файлы (sub привязан к этому doctorId);
 * - всё прочее — отказ с причиной (вызывающий обязан залогировать отказ).
 *
 * Проверка связи идёт на КАЖДЫЙ запрос (9.3 AC «потеря связи закрывает
 * доступ: следующий запрос presigned → 403») — никакого кэша прав.
 */
export async function checkFileAccess(
  ports: AccessPorts,
  subject: AccessSubject,
  target: AccessTarget,
): Promise<AccessResult> {
  if (subject.roles.includes('ADMIN')) return { allowed: true };

  if (target.ownerType === 'PATIENT') {
    if (subject.roles.includes('USER')) {
      const patient = await ports.findPatientByUser(subject.sub);
      if (!patient) return deny('у пользователя нет карточки пациента');
      if (patient.id !== target.ownerId) return deny('чужая карточка пациента');
      return { allowed: true };
    }
    if (subject.roles.includes('DOCTOR')) {
      const related = await ports.hasDoctorRelation(subject.sub, target.ownerId);
      if (related) return { allowed: true };
      return deny('нет действующей записи с этим пациентом');
    }
    return deny(`роль не даёт доступ к файлам пациента: [${subject.roles.join(', ')}]`);
  }

  // ownerType=DOCTOR: свои файлы по привязке sub → doctorId (9.1/9.3)
  if (subject.roles.includes('DOCTOR')) {
    const doctor = await ports.findDoctorByUser(subject.sub);
    if (doctor && doctor.id === target.ownerId) return { allowed: true };
    return deny('файлы другого врача недоступны');
  }

  return deny('файлы врачей доступны только админу');
}

/** DI-токен привязки реализации (сборка — в app/app.module.ts). */
export const ACCESS_PORTS = Symbol('FileAccessPorts');
