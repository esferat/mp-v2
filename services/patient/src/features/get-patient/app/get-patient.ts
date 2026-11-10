import type { Patient } from '@mp/contracts';
import {
  type PatientRepository,
  type PhotoUrlSigner,
  toPublicPatient,
} from '../../../entities/patient';
import { ForbiddenError, NotFoundError } from '../../../shared/model';

/** Публичная карточка + presigned-аватар (3.4/4.3: photoUrl для профиля). */
async function toProfilePatient(
  patient: Parameters<typeof toPublicPatient>[0],
  signer: PhotoUrlSigner | undefined,
): Promise<Patient> {
  const publicPatient = toPublicPatient(patient);
  const photoUrl = patient.photoKey && signer ? await signer.sign(patient.photoKey) : undefined;
  return { ...publicPatient, ...(photoUrl ? { photoUrl } : {}) };
}

/** Кто запрашивает карточку (claims токена, 1.2/4.2). */
export interface PatientAccessSubject {
  sub: string;
  roles: readonly string[];
}

/**
 * Чтение карточки по id (4.2: GET /api/patient/:id, подготовка Этапа 2):
 *
 * - ADMIN — любая карточка;
 * - USER — только своя (userId = sub): прямой запрос чужого id → 403,
 *   а не «молчаливое» раскрытие (защита в глубину к политике gateway);
 * - прочие роли — отказ.
 */
export async function getPatient(
  repository: PatientRepository,
  id: string,
  subject: PatientAccessSubject,
  signer?: PhotoUrlSigner,
): Promise<Patient> {
  const patient = await repository.findById(id);
  if (!patient) {
    throw new NotFoundError(`Пациент ${id} не найден`);
  }

  if (subject.roles.includes('ADMIN')) {
    return toProfilePatient(patient, signer);
  }
  if (subject.roles.includes('USER') && patient.userId === subject.sub) {
    return toProfilePatient(patient, signer);
  }

  throw new ForbiddenError('Карточка пациента недоступна этому пользователю');
}

/**
 * Внутреннее чтение карточки (5.3/9.3): вызывается сервисами напрямую
 * (scheduling — бронь админа), без ролевой фильтрации — защищает
 * JwtAuthGuard + сетевая зона контейнеров; наружу маршрут закрыт в gateway.
 */
export async function getPatientInternal(
  repository: PatientRepository,
  id: string,
): Promise<Patient> {
  const patient = await repository.findById(id);
  if (!patient) {
    throw new NotFoundError(`Пациент ${id} не найден`);
  }
  return toPublicPatient(patient);
}
