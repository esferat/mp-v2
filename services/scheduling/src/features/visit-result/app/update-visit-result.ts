import type { UpdateVisitResultRequest, VisitResult } from '@mp/contracts';
import { validateVisitResult, type VisitResultRepository } from '../../../entities/visit-result';
import type { AccessSubject } from '@mp/service-kit';
import { NotFoundError } from '../../../shared/model';
import { type OwningDoctorDeps, requireOwningDoctor } from './require-owning-doctor';

export type UpdateVisitResultDeps = OwningDoctorDeps & {
  visitResults: VisitResultRepository;
};

/**
 * Правка результата (9.2): только врач записи; валидация — в домене;
 * события не публикуются (appointment.completed.v1 уже уходил при внесении).
 */
export async function updateVisitResult(
  deps: UpdateVisitResultDeps,
  appointmentId: string,
  raw: UpdateVisitResultRequest,
  subject: AccessSubject,
): Promise<VisitResult> {
  await requireOwningDoctor(deps, appointmentId, subject);
  const data = validateVisitResult(raw);

  const updated = await deps.visitResults.update(appointmentId, data);
  if (!updated) {
    throw new NotFoundError(`Результат записи ${appointmentId} не найден`);
  }
  return updated;
}
