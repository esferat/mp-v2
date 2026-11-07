import { Module } from '@nestjs/common';
import { CreatePatientController } from './api/create-patient.controller';

/** Публичный API слайса (fsd.md §5). */
@Module({
  controllers: [CreatePatientController],
})
export class CreatePatientModule {}

export { createPatient } from './app/create-patient';
