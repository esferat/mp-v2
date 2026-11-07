import { Body, Controller, Inject, Post } from '@nestjs/common';
import { createPatientRequestSchema, type CreatePatientRequest, type Patient } from '@mp/contracts';
import type { PatientContext } from '../../../entities/patient';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../entities/repository';
import { ZodPipe } from '../../../shared/lib';
import { createPatient } from '../app/create-patient';

/**
 * Адаптер входа (fsd.md §4.2): Zod-валидация контракта → use-case слайса.
 * Внутренний маршрут (identity → patient напрямую, сага 1.4): наружу через
 * gateway создание не выдаётся (политика gateway: POST /api/patient → ADMIN).
 */
@Controller('api/patient')
export class CreatePatientController {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWork<PatientContext>,
  ) {}

  @Post()
  create(
    @Body(new ZodPipe(createPatientRequestSchema)) body: CreatePatientRequest,
  ): Promise<Patient> {
    return createPatient(this.unitOfWork, body);
  }
}
