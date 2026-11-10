import { Module } from '@nestjs/common';
import { MeController } from './api/me.controller';

/** Слайс профиля текущего пользователя (10.1, fsd.md S5). */
@Module({
  controllers: [MeController],
})
export class MeModule {}

export { getMyProfile, updateMyProfile } from './app/me';
