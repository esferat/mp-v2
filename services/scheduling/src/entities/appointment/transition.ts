import type { AppointmentStatus } from '@mp/contracts';
import { InvalidTransitionError, NotFoundError } from '../../shared/model';
import { type Appointment, type AppointmentContext, canTransition } from './appointment';

export interface TransitionResult {
  appointment: Appointment;
  /** Откуда ушли (для appointment.cancelled.v1, канон §1). */
  previousStatus: AppointmentStatus;
}

/**
 * Канонический переход статуса внутри транзакции (5.4): запись → машина
 * состояний → обновление. Нет записи → 404; недопустимый переход → 409
 * INVALID_TRANSITION, БД не меняется (AC 5.4).
 *
 * Повторная команда (двойной клик) сюда же попадает и даёт 409 без
 * побочных эффектов (канон: 409 зафиксирован как выбранный вариант).
 */
export async function applyTransition(
  context: AppointmentContext,
  id: string,
  to: AppointmentStatus,
  reason?: string | null,
): Promise<TransitionResult> {
  const current = await context.appointments.findById(id);
  if (!current) {
    throw new NotFoundError(`Запись ${id} не найдена`);
  }
  if (!canTransition(current.status, to)) {
    throw new InvalidTransitionError(current.status, to);
  }

  const updated = await context.appointments.updateStatus(id, to, reason ?? null);
  if (!updated) {
    throw new NotFoundError(`Запись ${id} не найдена`);
  }

  return { appointment: updated, previousStatus: current.status };
}
