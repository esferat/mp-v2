import { Body, Controller, Inject, Param, Put } from '@nestjs/common';
import {
  type Appointment,
  type CancelAppointmentRequest,
  cancelAppointmentSchema,
} from '@mp/contracts';
import type { AppointmentContext } from '../../../entities/appointment';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../entities/repository';
import { ZodPipe } from '../../../shared/lib';
import { cancelAppointment } from '../app/cancel-appointment';

/** Адаптер входа (5.4): отмена из SUBMITTED/APPROVED. */
@Controller('api/scheduling')
export class CancelAppointmentController {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWork<AppointmentContext>,
  ) {}

  @Put('appointments/:id/cancel')
  cancel(
    @Param('id') id: string,
    @Body(new ZodPipe(cancelAppointmentSchema)) body: CancelAppointmentRequest,
  ): Promise<Appointment> {
    return cancelAppointment(this.unitOfWork, id, body);
  }
}
