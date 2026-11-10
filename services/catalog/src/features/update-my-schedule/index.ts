import { Module } from '@nestjs/common';
import { UpdateMyScheduleController } from './api/update-my-schedule.controller';

/** Слайс API self-service расписания врача (10.4, fsd.md S5). */
@Module({
  controllers: [UpdateMyScheduleController],
})
export class UpdateMyScheduleModule {}

export { updateMySchedule } from './app/update-my-schedule';
