import { Module } from '@nestjs/common';
import { CreateDoctorAccountController } from './api/create-doctor-account.controller';

/**
 * Слайс «учётная запись существующего врача» (fsd.md S5): сага привязки
 * (правило «учётная запись создаётся администратором всегда»), только ADMIN.
 */
@Module({
  controllers: [CreateDoctorAccountController],
})
export class CreateDoctorAccountModule {}
