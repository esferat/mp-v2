import { Module } from '@nestjs/common';
import { SetPatientPhotoController } from './api/set-patient-photo.controller';

/** Публичный API слайса (fsd.md S5): привязка фото (4.3). */
@Module({
  controllers: [SetPatientPhotoController],
})
export class SetPatientPhotoModule {}

export { setPatientPhoto } from './app/set-patient-photo';
