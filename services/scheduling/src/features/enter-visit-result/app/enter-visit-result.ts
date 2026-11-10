import { type EnterVisitResultRequest, RoutingKeys, type VisitResult } from '@mp/contracts';
import type { AccessSubject } from '@mp/service-kit';
import { createEvent } from '@mp/service-kit';
import {
  applyTransition,
  type AppointmentContext,
  appointmentEventPayload,
} from '../../../entities/appointment';
import {
  type DoctorCatalogPort,
  findDoctorByUser,
  type ScheduleCopyRepository,
} from '../../../entities/schedule-copy';
import { validateVisitResult, type VisitResultContext } from '../../../entities/visit-result';
import type { UnitOfWork } from '../../../entities/repository';
import { ForbiddenError, NotFoundError } from '../../../shared/model';

export interface EnterVisitResultDeps {
  unitOfWork: UnitOfWork<AppointmentContext & VisitResultContext>;
  copies: ScheduleCopyRepository;
  /** Для re-import привязок созданных до 9.1 (fallback 3.5). */
  catalog?: DoctorCatalogPort;
}

/**
 * Внесение результата приёма (9.2): только врач ЗАПИСИ (doctorId из привязки
 * sub → копия расписания), только статус APPROVED (канон §1 → иначе 409),
 * транзакция: результат (unique по appointmentId) + статус COMPLETED +
 * событие appointment.completed.v1. Повторный submit идемпотентен: уже
 * внесённый результат возвращается без изменений (AC 9.2).
 */
export async function enterVisitResult(
  deps: EnterVisitResultDeps,
  appointmentId: string,
  raw: EnterVisitResultRequest,
  subject: AccessSubject,
): Promise<VisitResult> {
  const doctor = await findDoctorByUser(deps.copies, deps.catalog, subject.sub);
  if (!doctor) {
    throw new ForbiddenError('Учётная запись не привязана к карточке врача');
  }

  // Валидация — в домене (чек-лист 9.2), не в controller
  const data = validateVisitResult(raw);

  return deps.unitOfWork.run(async (context) => {
    const appointment = await context.appointments.findById(appointmentId);
    if (!appointment) {
      throw new NotFoundError(`Запись ${appointmentId} не найдена`);
    }
    if (appointment.doctorId !== doctor.doctorId) {
      throw new ForbiddenError('Запись назначена другому врачу');
    }

    // Идемпотентный повтор (двойной клик): результат уже внесён
    const existing = await context.visitResults.findByAppointmentId(appointmentId);
    if (existing) return existing;

    // APPROVED → COMPLETED (иначе 409 INVALID_TRANSITION, БД не меняется)
    const { appointment: completed } = await applyTransition(context, appointmentId, 'COMPLETED');

    const result = await context.visitResults.create({
      appointmentId,
      conclusion: data.conclusion,
      ...(data.recommendations ? { recommendations: data.recommendations } : {}),
      createdBy: subject.sub,
    });

    await context.outbox.enqueue(
      RoutingKeys.AppointmentCompleted,
      createEvent(appointmentEventPayload(completed)),
    );

    return result;
  });
}
