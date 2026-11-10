import type { VisitResult } from '@mp/contracts';
import type { VisitResultRepository } from '../../../entities/visit-result';
import type { AccessSubject } from '@mp/service-kit';
import { NotFoundError } from '../../../shared/model';
import { type OwningDoctorDeps, requireOwningDoctor } from './require-owning-doctor';

export type GetVisitResultDeps = OwningDoctorDeps & {
  visitResults: VisitResultRepository;
};

/**
 * Просмотр результата приёма (9.2): только врач записи; результата нет → 404.
 */
export async function getVisitResult(
  deps: GetVisitResultDeps,
  appointmentId: string,
  subject: AccessSubject,
): Promise<VisitResult> {
  await requireOwningDoctor(deps, appointmentId, subject);

  const result = await deps.visitResults.findByAppointmentId(appointmentId);
  if (!result) {
    throw new NotFoundError(`Результат записи ${appointmentId} не найден`);
  }
  return result;
}
