import { Controller, Get, Inject, Query, Req, UnauthorizedException } from '@nestjs/common';
import {
  appointmentListQuerySchema,
  type AppointmentListQuery,
  type AppointmentListResponse,
} from '@mp/contracts';
import type { RequestAuth } from '@mp/service-kit';
import { APPOINTMENT_REPOSITORY, type AppointmentRepository } from '../../../entities/appointment';
import { PATIENT_CLIENT, type PatientHttpClient } from '../../../shared/api';
import { ZodPipe } from '../../../shared/lib';
import { getMyAppointments } from '../app/get-my-appointments';

type AuthedRequest = { auth?: RequestAuth };

/** Адаптер входа (5.5): patientId строго из токена, query — пагинация. */
@Controller('api/scheduling')
export class GetMyAppointmentsController {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointments: AppointmentRepository,
    @Inject(PATIENT_CLIENT)
    private readonly patients: PatientHttpClient,
  ) {}

  @Get('appointments/me')
  me(
    @Query(new ZodPipe(appointmentListQuerySchema)) query: AppointmentListQuery,
    @Req() request: AuthedRequest,
  ): Promise<AppointmentListResponse> {
    const auth = request.auth;
    if (!auth) {
      throw new UnauthorizedException('Требуется токен доступа');
    }
    return getMyAppointments(
      { appointments: this.appointments, patients: this.patients },
      auth.sub,
      query,
    );
  }
}
