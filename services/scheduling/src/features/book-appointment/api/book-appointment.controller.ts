import { Body, Controller, Inject, Post, Req, UnauthorizedException } from '@nestjs/common';
import {
  bookAppointmentSchema,
  type Appointment,
  type BookAppointmentRequest,
} from '@mp/contracts';
import type { RequestAuth } from '@mp/service-kit';
import type { AppointmentContext } from '../../../entities/appointment';
import {
  SCHEDULE_COPY_REPOSITORY,
  type ScheduleCopyRepository,
} from '../../../entities/schedule-copy';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../entities/repository';
import { PATIENT_CLIENT, type PatientHttpClient } from '../../../shared/api';
import { ZodPipe } from '../../../shared/lib';
import { bookAppointment } from '../app/book-appointment';

type AuthedRequest = { auth?: RequestAuth };

/** Адаптер входа (5.3): тело → use-case; patientId — из токена или из запроса. */
@Controller('api/scheduling')
export class BookAppointmentController {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWork<AppointmentContext>,
    @Inject(SCHEDULE_COPY_REPOSITORY)
    private readonly copies: ScheduleCopyRepository,
    @Inject(PATIENT_CLIENT)
    private readonly patients: PatientHttpClient,
  ) {}

  @Post('appointments')
  book(
    @Body(new ZodPipe(bookAppointmentSchema)) body: BookAppointmentRequest,
    @Req() request: AuthedRequest,
  ): Promise<Appointment> {
    const auth = request.auth;
    if (!auth) {
      throw new UnauthorizedException('Требуется токен доступа');
    }
    return bookAppointment(
      { copies: this.copies, unitOfWork: this.unitOfWork, patients: this.patients },
      { request: body, subjectSub: auth.sub, subjectRoles: auth.realmRoles },
    );
  }
}
