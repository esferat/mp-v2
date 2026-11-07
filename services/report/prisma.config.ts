import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Конфигурация Prisma CLI (Prisma 7).
 *
 * DATABASE_URL обязателен для migrate/dev/seed и приходит из окружения
 * (compose-джоба) или services/report/.env (dotenv, локальная разработка).
 * Без переменной — dev-заглушка, чтобы `prisma generate` (кодг в CI) работал:
 * migrate в этом случае упадёт на подключении, а не молча возьмёт чужую БД.
 */
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://svc_report:svc_report_pw@localhost:5432/db_report';

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
