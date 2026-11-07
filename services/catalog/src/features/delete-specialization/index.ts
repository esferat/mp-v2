import { Module } from '@nestjs/common';
import { DeleteSpecializationController } from './api/delete-specialization.controller';

/** Публичный API слайса (fsd.md §5). */
@Module({
  controllers: [DeleteSpecializationController],
})
export class DeleteSpecializationModule {}

export { deleteSpecialization } from './app/delete-specialization';
