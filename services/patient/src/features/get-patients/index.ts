import { Module } from '@nestjs/common';
import { GetPatientsController } from './api/get-patients.controller';

/** Публичный API слайса (fsd.md S5): админский список пациентов (4.1). */
@Module({
  controllers: [GetPatientsController],
})
export class GetPatientsModule {}

export { getPatients } from './app/get-patients';
