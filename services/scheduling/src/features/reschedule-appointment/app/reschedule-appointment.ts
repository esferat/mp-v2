import { type Appointment, type RescheduleAppointmentRequest, RoutingKeys } from '@mp/contracts';
import { createEvent } from '@mp/service-kit';
import { type AppointmentContext, toApiAppointment } from '../../../entities/appointment';
import { isActiveCopy, type ScheduleCopyRepository } from '../../../entities/schedule-copy';
import { formatMinutes, toMinutes, validateSlotWindow } from '../../../entities/slots';
import type { UnitOfWork } from '../../../entities/repository';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../shared/model';

/**
 * Перенос записи (10.3, Этап 2.1): другого врача/дату/время БЕЗ смены статуса
 * (канон §1: SUBMITTED/APPROVED → те же). Инициатор — только ADMIN (проверка
 * и на gateway, и здесь — защита в глубину). Идемпотентность: повтор на ТОТ ЖЕ
 * слот/врача → 200 без события и журнала (AC 10.3).
 *
 * Атомарность: обновление + строка `appointment_reschedule_log` + событие
 * `appointment.rescheduled.v1` — одна транзакция (0.9); свободность нового
 * слота обеспечивает частичный уникальный индекс → 409 SLOT_TAKEN.
 */

export interface RescheduleDeps {
  unitOfWork: UnitOfWork<AppointmentContext>;
  copies: ScheduleCopyRepository;
  /** «сейчас» (подменяется в тестах). */
  now?: () => Date;
}

export interface RescheduleCommand {
  id: string;
  request: RescheduleAppointmentRequest;
  subject: { sub: string; roles: readonly string[] };
}

export async function rescheduleAppointment(
  deps: RescheduleDeps,
  command: RescheduleCommand,
): Promise<Appointment> {
  const { id, request, subject } = command;

  // Только ADMIN (10.3 AC: и на gateway, и в сервисе)
  if (!subject.roles.includes('ADMIN')) {
    throw new ForbiddenError('Перенос записи доступен только администратору');
  }

  const now = deps.now ? deps.now() : new Date();

  return deps.unitOfWork.run(async (context) => {
    const existing = await context.appointments.findById(id);
    if (!existing) throw new NotFoundError('Запись не найдена');

    // Канон §1: перенос только из SUBMITTED/APPROVED, статус не меняется
    if (existing.status !== 'SUBMITTED' && existing.status !== 'APPROVED') {
      throw new ConflictError(`Перенос недопустим из статуса ${existing.status}`, {
        code: 'INVALID_STATUS',
      });
    }

    const newDoctorId = request.doctorId ?? existing.doctorId;

    // Идемпотентный повтор (200 no-op): тот же врач, дата и время —
    // без события и строки журнала (AC 10.3)
    if (
      newDoctorId === existing.doctorId &&
      request.localDate === existing.localDate &&
      request.start === existing.startTime
    ) {
      return toApiAppointment(existing);
    }

    const copy = await deps.copies.findById(newDoctorId);
    if (!isActiveCopy(copy)) {
      throw new ValidationError('Врач не найден или не принимает запись', 'doctorId');
    }

    // Окно/рабочий день — та же чистая валидация, что в брони (5.3).
    // «Прошлое» по AC 10.3 → 409 (не 400): остальные нарушения окна → 400 с полем.
    const issue = validateSlotWindow(copy, request, now);
    if (issue) {
      const isPast =
        issue.message === 'Дата приёма в прошлом' || issue.message === 'Этот слот уже прошёл';
      if (isPast) {
        throw new ConflictError('Нельзя перенести на прошедшее время', { code: 'PAST_SLOT' });
      }
      throw new ValidationError(issue.message, issue.field.replace(/^slot\./, ''));
    }

    const slot = {
      localDate: request.localDate,
      start: request.start,
      end: formatMinutes((toMinutes(request.start) as number) + copy.durationMinutes),
    };

    const updated = await context.appointments.reschedule({
      id,
      doctorId: copy.doctorId,
      doctorName: fullName(copy),
      specializationId: copy.specializationId,
      specializationName: copy.specializationName,
      startTime: slot.start,
      endTime: slot.end,
      localDate: slot.localDate,
      log: {
        previousStatus: existing.status,
        old: {
          doctorId: existing.doctorId,
          localDate: existing.localDate,
          start: existing.startTime,
          end: existing.endTime,
        },
        changedBy: subject.sub,
        ...(request.reason ? { reason: request.reason } : {}),
      },
    });
    // Гонка: статус записи сменился между чтением и UPDATE → 409
    if (!updated) {
      throw new ConflictError('Запись уже обработана — перенос невозможен', {
        code: 'INVALID_STATUS',
      });
    }

    await context.outbox.enqueue(
      RoutingKeys.AppointmentRescheduled,
      createEvent({
        appointmentId: id,
        patientId: existing.patientId,
        previousStatus: existing.status,
        old: {
          doctorId: existing.doctorId,
          doctorName: existing.doctorName,
          specializationId: existing.specializationId,
          specializationName: existing.specializationName,
          slot: {
            localDate: existing.localDate,
            start: existing.startTime,
            end: existing.endTime,
          },
        },
        new: {
          doctorId: updated.doctorId,
          doctorName: updated.doctorName,
          specializationId: updated.specializationId,
          specializationName: updated.specializationName,
          slot: { localDate: updated.localDate, start: updated.startTime, end: updated.endTime },
        },
        ...(request.reason ? { reason: request.reason } : {}),
      }),
    );

    return toApiAppointment(updated);
  });
}

/** ФИО врача из копии расписания (как в book-appointment, DRY). */
function fullName(copy: { firstName?: string; lastName?: string; middleName?: string }): string {
  return [copy.lastName, copy.firstName, copy.middleName].filter(Boolean).join(' ');
}
