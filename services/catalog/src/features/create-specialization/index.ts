import { Module } from '@nestjs/common';
import { CreateSpecializationController } from './api/create-specialization.controller';

/** Публичный API слайса (fsd.md §5). */
@Module({
  controllers: [CreateSpecializationController],
})
export class CreateSpecializationModule {}

export { createSpecialization } from './app/create-specialization';
export type { CreateSpecializationCommand } from './app/create-specialization';
