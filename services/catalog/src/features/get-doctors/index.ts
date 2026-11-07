import { Module } from '@nestjs/common';
import { GetDoctorsController } from './api/get-doctors.controller';

/** Публичный API слайса (fsd.md §5): GET /api/catalog/doctors (3.1). */
@Module({
  controllers: [GetDoctorsController],
})
export class GetDoctorsModule {}

export { getDoctors } from './app/get-doctors';
