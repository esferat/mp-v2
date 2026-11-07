import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Конфигурация Prisma CLI (Prisma 7).
 *
 * DATABASE_URL обязателен для migrate/dev/seed и приходит из окружения
 * (compose-джоба) или services/scheduling/.env (dotenv, локальная разработка).
 * Без переменной — dev-заглушка, чтобы `prisma generate` (кодг в CI) работал:
 * migrate в этом случае упадёт на подключении, а не молча возьмёт чужую БД.
 */
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://svc_schedule:svc_schedule_pw@localhost:5432/db_schedule';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
