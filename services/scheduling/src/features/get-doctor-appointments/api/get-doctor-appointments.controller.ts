import { Controller, Get, Inject, Query, Req, UnauthorizedException } from '@nestjs/common';
import {
  type AppointmentListQuery,
  appointmentListQuerySchema,
  type AppointmentListResponse,
} from '@mp/contracts';
import type { RequestAuth } from '@mp/service-kit';
import { APPOINTMENT_REPOSITORY, type AppointmentRepository } from '../../../entities/appointment';
import {
  SCHEDULE_COPY_REPOSITORY,
  type ScheduleCopyRepository,
} from '../../../entities/schedule-copy';
import { ZodPipe } from '../../../shared/lib';
import { CATALOG_CLIENT, type CatalogHttpClient } from '../../../shared/api';
import { getDoctorAppointments } from '../app/get-doctor-appointments';

type AuthedRequest = { auth?: RequestAuth };

/** Адаптер входа (9.2): GET /api/scheduling/appointments/doctor. */
@Controller('api/scheduling')
export class GetDoctorAppointmentsController {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointments: AppointmentRepository,
    @Inject(SCHEDULE_COPY_REPOSITORY)
    private readonly copies: ScheduleCopyRepository,
    @Inject(CATALOG_CLIENT)
    private readonly catalog: CatalogHttpClient,
  ) {}

  @Get('appointments/doctor')
  list(
    @Query(new ZodPipe(appointmentListQuerySchema)) query: AppointmentListQuery,
    @Req() request: AuthedRequest,
  ): Promise<AppointmentListResponse> {
    const auth = request.auth;
    if (!auth) throw new UnauthorizedException('Требуется токен доступа');
    return getDoctorAppointments(
      { appointments: this.appointments, copies: this.copies, catalog: this.catalog },
      query,
      { sub: auth.sub, roles: auth.realmRoles },
    );
  }
}
