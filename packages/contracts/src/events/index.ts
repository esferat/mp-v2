import {
  appointmentApprovedV1,
  appointmentCancelledV1,
  appointmentCompletedV1,
  appointmentDeclinedV1,
  appointmentSubmittedV1,
} from './appointment';
import { documentDeletedV1, documentUploadedV1 } from './document';
import { doctorCreatedV1, doctorUpdatedV1, specializationChangedV1 } from './doctor';
import { patientCreatedV1, patientUpdatedV1 } from './patient';
import { userRegisteredV1, userRoleChangedV1 } from './user';

export * from './common';
export * from './appointment';
export * from './document';
export * from './doctor';
export * from './patient';
export * from './user';

/** Routing keys topic-exchange `medical.events` (architecture.md §6.4). */
export const RoutingKeys = {
  UserRegistered: 'user.registered.v1',
  UserRoleChanged: 'user.role-changed.v1',
  PatientCreated: 'patient.created.v1',
  PatientUpdated: 'patient.updated.v1',
  DoctorCreated: 'doctor.created.v1',
  DoctorUpdated: 'doctor.updated.v1',
  SpecializationChanged: 'specialization.changed.v1',
  DocumentUploaded: 'document.uploaded.v1',
  DocumentDeleted: 'document.deleted.v1',
  AppointmentSubmitted: 'appointment.submitted.v1',
  AppointmentApproved: 'appointment.approved.v1',
  AppointmentDeclined: 'appointment.declined.v1',
  AppointmentCancelled: 'appointment.cancelled.v1',
  AppointmentCompleted: 'appointment.completed.v1',
} as const;

export type RoutingKey = (typeof RoutingKeys)[keyof typeof RoutingKeys];

/** Реестр схем: routing key → Zod-схема конверта. Единственный источник для потребителей. */
export const eventSchemas = {
  [RoutingKeys.UserRegistered]: userRegisteredV1,
  [RoutingKeys.UserRoleChanged]: userRoleChangedV1,
  [RoutingKeys.PatientCreated]: patientCreatedV1,
  [RoutingKeys.PatientUpdated]: patientUpdatedV1,
  [RoutingKeys.DoctorCreated]: doctorCreatedV1,
  [RoutingKeys.DoctorUpdated]: doctorUpdatedV1,
  [RoutingKeys.SpecializationChanged]: specializationChangedV1,
  [RoutingKeys.DocumentUploaded]: documentUploadedV1,
  [RoutingKeys.DocumentDeleted]: documentDeletedV1,
  [RoutingKeys.AppointmentSubmitted]: appointmentSubmittedV1,
  [RoutingKeys.AppointmentApproved]: appointmentApprovedV1,
  [RoutingKeys.AppointmentDeclined]: appointmentDeclinedV1,
  [RoutingKeys.AppointmentCancelled]: appointmentCancelledV1,
  [RoutingKeys.AppointmentCompleted]: appointmentCompletedV1,
} as const satisfies Record<string, import('zod').ZodType>;

/** Проверка сообщения по схеме его routing key. Несовпадение → DLQ, не крах (0.6). */
export function parseEvent<T extends RoutingKey>(
  routingKey: T,
  message: unknown,
): import('zod').z.output<(typeof eventSchemas)[T]> {
  const schema = eventSchemas[routingKey];
  return schema.parse(message) as import('zod').z.output<(typeof eventSchemas)[T]>;
}
