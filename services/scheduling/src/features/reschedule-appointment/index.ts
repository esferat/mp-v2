import { Module } from '@nestjs/common';
import { RescheduleAppointmentController } from './api/reschedule-appointment.controller';

/** Слайс переноса записи (10.3, fsd.md S5). */
@Module({
  controllers: [RescheduleAppointmentController],
})
export class RescheduleAppointmentModule {}

export { rescheduleAppointment } from './app/reschedule-appointment';
