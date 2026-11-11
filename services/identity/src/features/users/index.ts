import { Module } from '@nestjs/common';
import { UsersController } from './api/users.controller';

/** Слайс профиля пользователя для админки (3.2: email врача, fsd.md S5). */
@Module({
  controllers: [UsersController],
})
export class UsersModule {}

export { getUserProfile, updateUserProfile } from './app/users';
