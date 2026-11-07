import { Module } from '@nestjs/common';
import { UpdateDoctorController } from './api/update-doctor.controller';

/** Публичный API слайса (fsd.md S5). */
@Module({
  controllers: [UpdateDoctorController],
})
export class UpdateDoctorModule {}

export { updateDoctor } from './app/update-doctor';
