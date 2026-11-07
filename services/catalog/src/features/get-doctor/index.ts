import { Module } from '@nestjs/common';
import { GetDoctorController } from './api/get-doctor.controller';

/** Публичный API слайса (fsd.md S5). */
@Module({
  controllers: [GetDoctorController],
})
export class GetDoctorModule {}

export { getDoctor, getDoctorByUser } from './app/get-doctor';
