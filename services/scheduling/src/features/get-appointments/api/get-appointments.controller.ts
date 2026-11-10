import { Controller, Get, Inject, Query } from '@nestjs/common';
import {
  type AppointmentListQuery,
  appointmentListQuerySchema,
  type AppointmentListResponse,
} from '@mp/contracts';
import { APPOINTMENT_REPOSITORY, type AppointmentRepository } from '../../../entities/appointment';
import { ZodPipe } from '../../../shared/lib';
import { getAppointments } from '../app/get-appointments';

/** Адаптер входа (5.4): фильтры → use-case списка записей. */
@Controller('api/scheduling')
export class GetAppointmentsController {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repository: AppointmentRepository,
  ) {}

  @Get('appointments')
  list(
    @Query(new ZodPipe(appointmentListQuerySchema)) query: AppointmentListQuery,
  ): Promise<AppointmentListResponse> {
    return getAppointments(this.repository, query);
  }
}
