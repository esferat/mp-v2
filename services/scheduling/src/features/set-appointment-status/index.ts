import { Module } from '@nestjs/common';
import { SetAppointmentStatusController } from './api/set-appointment-status.controller';

/** Публичный API слайса (fsd.md S5): приём/отклонение записи (5.4). */
@Module({
  controllers: [SetAppointmentStatusController],
})
export class SetAppointmentStatusModule {}

export { setAppointmentStatus } from './app/set-appointment-status';
