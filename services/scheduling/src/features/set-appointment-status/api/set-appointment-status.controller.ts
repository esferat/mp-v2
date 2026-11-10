import { Body, Controller, Inject, Param, Put } from '@nestjs/common';
import {
  type Appointment,
  type SetAppointmentStatusRequest,
  setAppointmentStatusSchema,
} from '@mp/contracts';
import type { AppointmentContext } from '../../../entities/appointment';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../entities/repository';
import { ZodPipe } from '../../../shared/lib';
import { setAppointmentStatus } from '../app/set-appointment-status';

/** Адаптер входа (5.4): APPROVED / DECLINED из SUBMITTED. */
@Controller('api/scheduling')
export class SetAppointmentStatusController {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWork<AppointmentContext>,
  ) {}

  @Put('appointments/:id/status')
  set(
    @Param('id') id: string,
    @Body(new ZodPipe(setAppointmentStatusSchema)) body: SetAppointmentStatusRequest,
  ): Promise<Appointment> {
    return setAppointmentStatus(this.unitOfWork, id, body);
  }
}
