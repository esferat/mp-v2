import { Module } from '@nestjs/common';
import { GetPatientController } from './api/get-patient.controller';

/** Публичный API слайса (fsd.md S5): чтение карточки по id (4.2). */
@Module({
  controllers: [GetPatientController],
})
export class GetPatientModule {}

export { getPatient, getPatientInternal } from './app/get-patient';
export type { PatientAccessSubject } from './app/get-patient';
