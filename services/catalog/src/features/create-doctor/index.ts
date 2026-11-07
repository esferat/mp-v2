import { Module } from '@nestjs/common';
import { CreateDoctorController } from './api/create-doctor.controller';

/** Публичный API слайса (fsd.md S5). */
@Module({
  controllers: [CreateDoctorController],
})
export class CreateDoctorModule {}

export { createDoctor } from './app/create-doctor';
