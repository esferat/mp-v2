import { Module } from '@nestjs/common';
import { RegisterController } from './api/register.controller';

/**
 * Публичный API слайса (fsd.md §5): POST /api/identity/register →
 * процесс register-user-saga.
 */
@Module({
  controllers: [RegisterController],
})
export class RegisterModule {}
