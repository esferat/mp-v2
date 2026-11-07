import { Module } from '@nestjs/common';
import { SetDoctorPhotoController } from './api/set-doctor-photo.controller';

/** Публичный API слайса (fsd.md S5): привязка фото врача (3.4). */
@Module({
  controllers: [SetDoctorPhotoController],
})
export class SetDoctorPhotoModule {}

export { setDoctorPhoto } from './app/set-doctor-photo';
