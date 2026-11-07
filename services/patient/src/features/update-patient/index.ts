import { Module } from '@nestjs/common';
import { UpdatePatientController } from './api/update-patient.controller';

/** Публичный API слайса (fsd.md S5): обновление карточки (4.2). */
@Module({
  controllers: [UpdatePatientController],
})
export class UpdatePatientModule {}

export { updatePatient } from './app/update-patient';
export type { UpdateSubject } from './app/update-patient';
