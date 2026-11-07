import { Module } from '@nestjs/common';
import { GetDoctorAppointmentsController } from './api/get-doctor-appointments.controller';

/** Публичный API слайса (fsd.md S5): приёмы врача (9.2). */
@Module({
  controllers: [GetDoctorAppointmentsController],
})
export class GetDoctorAppointmentsModule {}

export { getDoctorAppointments } from './app/get-doctor-appointments';
export type { GetDoctorAppointmentsDeps } from './app/get-doctor-appointments';
