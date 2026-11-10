import { Controller, Get, Inject, Param } from '@nestjs/common';
import type { DoctorSchedule } from '@mp/contracts';
import type { ScheduleCopyRepository } from '../../../entities/schedule-copy';
import { SCHEDULE_COPY_REPOSITORY } from '../../../entities/schedule-copy';
import { getDoctorSchedule } from '../app/get-doctor-schedule';

/** Адаптер входа (10.3 UI): GET /api/scheduling/doctors/:id/schedule. */
@Controller('api/scheduling')
export class GetDoctorScheduleController {
  constructor(
    @Inject(SCHEDULE_COPY_REPOSITORY)
    private readonly copies: ScheduleCopyRepository,
  ) {}

  @Get('doctors/:id/schedule')
  get(@Param('id') id: string): Promise<DoctorSchedule> {
    return getDoctorSchedule(this.copies, id);
  }
}
