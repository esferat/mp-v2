import { Module } from '@nestjs/common';
import { GetAppointmentsController } from './api/get-appointments.controller';

/** Публичный API слайса (fsd.md S5): список записей с фильтрами (5.4). */
@Module({
  controllers: [GetAppointmentsController],
})
export class GetAppointmentsModule {}

export { getAppointments } from './app/get-appointments';
