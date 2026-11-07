import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { UpdateVisitResultRequest, VisitResult } from '@mp/contracts';
import type { RequestAuth } from '@mp/service-kit';
import { APPOINTMENT_REPOSITORY, type AppointmentRepository } from '../../../entities/appointment';
import {
  SCHEDULE_COPY_REPOSITORY,
  type ScheduleCopyRepository,
} from '../../../entities/schedule-copy';
import {
  VISIT_RESULT_REPOSITORY,
  type VisitResultRepository,
} from '../../../entities/visit-result';
import { CATALOG_CLIENT, type CatalogHttpClient } from '../../../shared/api';
import { getVisitResult } from '../app/get-visit-result';
import { updateVisitResult } from '../app/update-visit-result';

type AuthedRequest = { auth?: RequestAuth };

/** Адаптер входа (9.2): просмотр и правка результата — только врач записи. */
@Controller('api/scheduling')
export class VisitResultController {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointments: AppointmentRepository,
    @Inject(SCHEDULE_COPY_REPOSITORY)
    private readonly copies: ScheduleCopyRepository,
    @Inject(VISIT_RESULT_REPOSITORY)
    private readonly visitResults: VisitResultRepository,
    @Inject(CATALOG_CLIENT)
    private readonly catalog: CatalogHttpClient,
  ) {}

  private subject(request: AuthedRequest): { sub: string; roles: readonly string[] } {
    const auth = request.auth;
    if (!auth) throw new UnauthorizedException('Требуется токен доступа');
    return { sub: auth.sub, roles: auth.realmRoles };
  }

  @Get('appointments/:id/result')
  get(@Param('id') id: string, @Req() request: AuthedRequest): Promise<VisitResult> {
    return getVisitResult(
      {
        appointments: this.appointments,
        copies: this.copies,
        visitResults: this.visitResults,
        catalog: this.catalog,
      },
      id,
      this.subject(request),
    );
  }

  @Put('appointments/:id/result')
  update(
    @Param('id') id: string,
    @Body() body: UpdateVisitResultRequest,
    @Req() request: AuthedRequest,
  ): Promise<VisitResult> {
    return updateVisitResult(
      {
        appointments: this.appointments,
        copies: this.copies,
        visitResults: this.visitResults,
        catalog: this.catalog,
      },
      id,
      body ?? {},
      this.subject(request),
    );
  }
}
