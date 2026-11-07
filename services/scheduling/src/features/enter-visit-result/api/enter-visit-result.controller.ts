import { Body, Controller, Inject, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { EnterVisitResultRequest, VisitResult } from '@mp/contracts';
import type { RequestAuth } from '@mp/service-kit';
import type { AppointmentContext } from '../../../entities/appointment';
import type { VisitResultContext } from '../../../entities/visit-result';
import {
  SCHEDULE_COPY_REPOSITORY,
  type ScheduleCopyRepository,
} from '../../../entities/schedule-copy';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../entities/repository';
import { CATALOG_CLIENT, type CatalogHttpClient } from '../../../shared/api';
import { enterVisitResult } from '../app/enter-visit-result';

type AuthedRequest = { auth?: RequestAuth };

/** Адаптер входа (9.2): внесение результата врачом своей записи. */
@Controller('api/scheduling')
export class EnterVisitResultController {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWork<AppointmentContext & VisitResultContext>,
    @Inject(SCHEDULE_COPY_REPOSITORY)
    private readonly copies: ScheduleCopyRepository,
    @Inject(CATALOG_CLIENT)
    private readonly catalog: CatalogHttpClient,
  ) {}

  @Post('appointments/:id/result')
  async enter(
    @Param('id') id: string,
    @Body() body: EnterVisitResultRequest,
    @Req() request: AuthedRequest,
  ): Promise<VisitResult> {
    const auth = request.auth;
    if (!auth) throw new UnauthorizedException('Требуется токен доступа');

    return enterVisitResult(
      { unitOfWork: this.unitOfWork, copies: this.copies, catalog: this.catalog },
      id,
      body ?? {},
      { sub: auth.sub, roles: auth.realmRoles },
    );
  }
}
