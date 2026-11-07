import { Controller, Get, Inject, Req, UnauthorizedException } from '@nestjs/common';
import type { DoctorPatientList } from '@mp/contracts';
import type { RequestAuth } from '@mp/service-kit';
import { APPOINTMENT_REPOSITORY, type AppointmentRepository } from '../../../entities/appointment';
import {
  SCHEDULE_COPY_REPOSITORY,
  type ScheduleCopyRepository,
} from '../../../entities/schedule-copy';
import { CATALOG_CLIENT, type CatalogHttpClient } from '../../../shared/api';
import { getDoctorPatients } from '../app/get-doctor-patients';

type AuthedRequest = { auth?: RequestAuth };

/** Адаптер входа (9.3): GET /api/scheduling/appointments/doctor/patients. */
@Controller('api/scheduling')
export class GetDoctorPatientsController {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointments: AppointmentRepository,
    @Inject(SCHEDULE_COPY_REPOSITORY)
    private readonly copies: ScheduleCopyRepository,
    @Inject(CATALOG_CLIENT)
    private readonly catalog: CatalogHttpClient,
  ) {}

  @Get('appointments/doctor/patients')
  list(@Req() request: AuthedRequest): Promise<DoctorPatientList> {
    const auth = request.auth;
    if (!auth) throw new UnauthorizedException('Требуется токен доступа');
    return getDoctorPatients(
      { appointments: this.appointments, copies: this.copies, catalog: this.catalog },
      { sub: auth.sub, roles: auth.realmRoles },
    );
  }
}
