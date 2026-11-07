import { Module } from '@nestjs/common';
import { RegisterDoctorController } from './api/register-doctor.controller';

/**
 * Публичный API слайса (fsd.md §5): POST /api/identity/doctors →
 * процесс register-doctor-saga (9.1).
 */
@Module({
  controllers: [RegisterDoctorController],
})
export class RegisterDoctorModule {}
