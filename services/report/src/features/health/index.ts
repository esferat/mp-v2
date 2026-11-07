import { Module } from '@nestjs/common';
import { HealthModule } from '@mp/service-kit';
import { RegisterHealthChecks } from './checks';

/**
 * Слайс health (заглушка по чек-листу 0.7): подключает health-эндпоинты
 * из service-kit и регистрирует проверки зависимостей сервиса.
 */
@Module({
  imports: [HealthModule],
  providers: [RegisterHealthChecks],
})
export class HealthFeatureModule {}

export { RegisterHealthChecks } from './checks';
