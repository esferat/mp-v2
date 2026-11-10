import { Body, Controller, Inject, Put, Req, UnauthorizedException } from '@nestjs/common';
import { type UpdateDoctorScheduleRequest, updateDoctorScheduleSchema } from '@mp/contracts';
import type { RequestAuth } from '@mp/service-kit';
import type { DoctorContext, DoctorListItem } from '../../../entities/doctor';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../entities/repository';
import { ZodPipe } from '../../../shared/lib';
import { updateMySchedule } from '../app/update-my-schedule';

type AuthedRequest = { auth?: RequestAuth };

/**
 * Адаптер входа (10.4): PUT /api/catalog/doctors/me/schedule — врач меняет
 * расписание своей карточки; sub берётся из токена, id в пути/теле нет.
 */
@Controller('api/catalog/doctors')
export class UpdateMyScheduleController {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWork<DoctorContext>,
  ) {}

  @Put('me/schedule')
  update(
    @Body(new ZodPipe(updateDoctorScheduleSchema)) body: UpdateDoctorScheduleRequest,
    @Req() request: AuthedRequest,
  ): Promise<DoctorListItem> {
    const auth = request.auth;
    if (!auth) throw new UnauthorizedException('Требуется токен доступа');
    return updateMySchedule(this.unitOfWork, body, { sub: auth.sub });
  }
}
