import { Module } from '@nestjs/common';
import { GetPatientByUserController } from './api/get-patient-by-user.controller';

/** Публичный API слайса (fsd.md §5). */
@Module({
  controllers: [GetPatientByUserController],
})
export class GetPatientByUserModule {}

export { getPatientByUser } from './app/get-patient-by-user';
