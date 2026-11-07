import { Controller, Get, Inject, Query } from '@nestjs/common';
import { slotsQuerySchema, type SlotList, type SlotsQuery } from '@mp/contracts';
import { LOGGER, type Logger } from '@mp/service-kit';
import { APPOINTMENT_REPOSITORY, type AppointmentRepository } from '../../../entities/appointment';
import {
  SCHEDULE_COPY_REPOSITORY,
  type ScheduleCopyRepository,
} from '../../../entities/schedule-copy';
import { CATALOG_CLIENT, type CatalogHttpClient } from '../../../shared/api';
import { ZodPipe } from '../../../shared/lib';
import { getSpecSlots } from '../app/get-spec-slots';

/** Адаптер входа: query → use-case слотов (5.2). */
@Controller('api/scheduling')
export class GetSpecSlotsController {
  constructor(
    @Inject(SCHEDULE_COPY_REPOSITORY)
    private readonly copies: ScheduleCopyRepository,
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointments: AppointmentRepository,
    @Inject(CATALOG_CLIENT)
    private readonly catalog: CatalogHttpClient,
    @Inject(LOGGER)
    private readonly log: Logger,
  ) {}

  @Get('slots')
  slots(@Query(new ZodPipe(slotsQuerySchema)) query: SlotsQuery): Promise<SlotList> {
    return getSpecSlots(
      {
        copies: this.copies,
        appointments: this.appointments,
        catalog: this.catalog,
        log: this.log,
      },
      query,
    );
  }
}
