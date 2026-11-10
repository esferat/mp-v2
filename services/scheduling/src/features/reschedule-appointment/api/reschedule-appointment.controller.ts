import { Body, Controller, Inject, Param, Put, Req, UnauthorizedException } from '@nestjs/common';
import {
  type Appointment,
  type RescheduleAppointmentRequest,
  rescheduleAppointmentSchema,
} from '@mp/contracts';
import type { RequestAuth } from '@mp/service-kit';
import type { ScheduleCopyRepository } from '../../../entities/schedule-copy';
import { SCHEDULE_COPY_REPOSITORY } from '../../../entities/schedule-copy';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../entities/repository';
import type { AppointmentContext } from '../../../entities/appointment';
import { ZodPipe } from '../../../shared/lib';
import { rescheduleAppointment } from '../app/reschedule-appointment';

type AuthedRequest = { auth?: RequestAuth };

/**
 * Адаптер входа (10.3): PUT /api/scheduling/appointments/:id/reschedule —
 * перенос без смены статуса; sub/роли берутся из токена (ADMIN-only
 * проверяется и в use-case — защита в глубину).
 */
@Controller('api/scheduling')
export class RescheduleAppointmentController {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWork<AppointmentContext>,
    @Inject(SCHEDULE_COPY_REPOSITORY)
    private readonly copies: ScheduleCopyRepository,
  ) {}

  @Put('appointments/:id/reschedule')
  reschedule(
    @Param('id') id: string,
    @Body(new ZodPipe(rescheduleAppointmentSchema)) body: RescheduleAppointmentRequest,
    @Req() request: AuthedRequest,
  ): Promise<Appointment> {
    const auth = request.auth;
    if (!auth) throw new UnauthorizedException('Требуется токен доступа');
    return rescheduleAppointment(
      { unitOfWork: this.unitOfWork, copies: this.copies },
      { id, request: body, subject: { sub: auth.sub, roles: auth.realmRoles } },
    );
  }
}
