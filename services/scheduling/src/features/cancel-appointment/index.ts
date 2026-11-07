import { Module } from '@nestjs/common';
import { CancelAppointmentController } from './api/cancel-appointment.controller';

/** Публичный API слайса (fsd.md S5): отмена записи (5.4). */
@Module({
  controllers: [CancelAppointmentController],
})
export class CancelAppointmentModule {}

export { cancelAppointment } from './app/cancel-appointment';
