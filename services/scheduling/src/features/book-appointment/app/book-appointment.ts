import type { Patient } from '@mp/contracts';
import { type Appointment, type BookAppointmentRequest, RoutingKeys } from '@mp/contracts';
import { createEvent } from '@mp/service-kit';
import type { AppointmentContext } from '../../../entities/appointment';
import { appointmentEventPayload, toApiAppointment } from '../../../entities/appointment';
import { isActiveCopy, type ScheduleCopyRepository } from '../../../entities/schedule-copy';
import { formatMinutes, toMinutes, validateSlotWindow } from '../../../entities/slots';
import type { UnitOfWork } from '../../../entities/repository';
import { ValidationError } from '../../../shared/model';

/** Минимальный порт пациентов (реализация — shared/api patient-клиент). */
export interface BookPatientPort {
  findByUser(userId: string): Promise<Patient | null>;

  findById(patientId: string): Promise<Patient | null>;
}

export interface BookAppointmentDeps {
  copies: ScheduleCopyRepository;
  unitOfWork: UnitOfWork<AppointmentContext>;
  patients: BookPatientPort;
  /** Часы (подменяются в тестах: проверка «слот не в прошлом»). */
  now?: () => Date;
}

export interface BookAppointmentCommand {
  request: BookAppointmentRequest;
  /** sub из проверенного токена (USER — источник patientId, 5.3). */
  subjectSub: string;
  subjectRoles: readonly string[];
}

function fullName(patient: { firstName: string; lastName: string; middleName?: string }): string {
  return [patient.lastName, patient.firstName, patient.middleName ?? '']
    .filter((part) => part.length > 0)
    .join(' ');
}

/**
 * Бронирование слота (5.3): проверки (врач активен в копии, окно/день/дата,
 * пациент существует) → INSERT с частичным уникальным индексом + событие
 * appointment.submitted.v1 в одной транзакции. Конфликт дубля → 409 SLOT_TAKEN.
 */
export async function bookAppointment(
  deps: BookAppointmentDeps,
  command: BookAppointmentCommand,
): Promise<Appointment> {
  const { request } = command;
  const now = deps.now ? deps.now() : new Date();

  // 1) Врач активен и есть в копии расписания (5.3)
  const copy = await deps.copies.findById(request.doctorId);
  if (!isActiveCopy(copy)) {
    throw new ValidationError('Врач не найден или не принимает запись', 'doctorId');
  }

  // 2) Дата/время: чистая проверка в entities/slots (5.3) → 400 с полем
  const issue = validateSlotWindow(copy, request.slot, now);
  if (issue) throw new ValidationError(issue.message, issue.field);

  // 3) Пациент: из токена (USER) или явный id (ADMIN)
  let patient: Patient | null;
  const fromToken = command.subjectRoles.includes('USER') || !request.patientId;
  if (fromToken) {
    patient = await deps.patients.findByUser(command.subjectSub);
    if (!patient) {
      throw new ValidationError('Пациент не найден (нет карточки)', 'patientId');
    }
  } else {
    if (!request.patientId) {
      throw new ValidationError('Укажите patientId', 'patientId');
    }
    patient = await deps.patients.findById(request.patientId);
    if (!patient) {
      throw new ValidationError('Пациент не найден', 'patientId');
    }
  }

  const duration = copy.durationMinutes;
  const slot = {
    localDate: request.slot.localDate,
    start: request.slot.start,
    end: formatMinutes((toMinutes(request.slot.start) as number) + duration),
  };
  const snapshot = {
    patientId: patient.id,
    patientName: fullName(patient),
    doctorId: copy.doctorId,
    doctorName: fullName(copy),
    specializationId: copy.specializationId,
    specializationName: copy.specializationName,
  };

  // 4) Транзакция: строка + событие (дубль слота гасится индексом → 409)
  return deps.unitOfWork.run(async (context) => {
    const appointment = await context.appointments.create({
      ...snapshot,
      startTime: slot.start,
      endTime: slot.end,
      localDate: slot.localDate,
    });

    await context.outbox.enqueue(
      RoutingKeys.AppointmentSubmitted,
      createEvent(appointmentEventPayload(appointment)),
    );

    return toApiAppointment(appointment);
  });
}
