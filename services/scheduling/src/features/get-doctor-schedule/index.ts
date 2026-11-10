import { Module } from '@nestjs/common';
import { GetDoctorScheduleController } from './api/get-doctor-schedule.controller';

/** Слайс расписания врача (10.3 UI, fsd.md S5). */
@Module({
  controllers: [GetDoctorScheduleController],
})
export class GetDoctorScheduleModule {}

export { getDoctorSchedule } from './app/get-doctor-schedule';
