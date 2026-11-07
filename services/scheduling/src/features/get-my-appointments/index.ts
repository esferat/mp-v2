import { Module } from '@nestjs/common';
import { GetMyAppointmentsController } from './api/get-my-appointments.controller';

/** Публичный API слайса (fsd.md S5): история записей пациента (5.5). */
@Module({
  controllers: [GetMyAppointmentsController],
})
export class GetMyAppointmentsModule {}

export { getMyAppointments } from './app/get-my-appointments';
export type { GetMyAppointmentsDeps } from './app/get-my-appointments';
