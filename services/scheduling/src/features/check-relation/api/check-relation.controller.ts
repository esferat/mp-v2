import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import {
  doctorRelationQuerySchema,
  type DoctorByUserResponse,
  type DoctorRelationQuery,
  type DoctorRelationResponse,
} from '@mp/contracts';
import { APPOINTMENT_REPOSITORY, type AppointmentRepository } from '../../../entities/appointment';
import {
  SCHEDULE_COPY_REPOSITORY,
  type ScheduleCopyRepository,
} from '../../../entities/schedule-copy';
import { ZodPipe } from '../../../shared/lib';
import { CATALOG_CLIENT, type CatalogHttpClient } from '../../../shared/api';
import { checkDoctorRelation, getDoctorByUser } from '../app/check-relation';

/**
 * Адаптер входа (9.3): служебный маршрут file → scheduling (напрямую,
 * не через gateway: токен svc-file, роль в политике не участвует).
 * Проверка проходит при любом валидном токене (защита в глубину — зона
 * контейнеров, наружу маршрут не экспонируется).
 */
@Controller('api/scheduling/relations')
export class CheckRelationController {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointments: AppointmentRepository,
    @Inject(SCHEDULE_COPY_REPOSITORY)
    private readonly copies: ScheduleCopyRepository,
    @Inject(CATALOG_CLIENT)
    private readonly catalog: CatalogHttpClient,
  ) {}

  @Get('check')
  check(
    @Query(new ZodPipe(doctorRelationQuerySchema)) query: DoctorRelationQuery,
  ): Promise<DoctorRelationResponse> {
    return checkDoctorRelation(
      { appointments: this.appointments, copies: this.copies, catalog: this.catalog },
      query,
    );
  }

  /** Привязка sub → doctorId (9.3: файлы самого врача); нет привязки → 404. */
  @Get('doctor/:userId')
  doctorByUser(@Param('userId') userId: string): Promise<DoctorByUserResponse> {
    return getDoctorByUser(
      { appointments: this.appointments, copies: this.copies, catalog: this.catalog },
      userId,
    );
  }
}
