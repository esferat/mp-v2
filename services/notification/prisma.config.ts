import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Конфигурация Prisma CLI для сервиса notification (Prisma 7).
 * DATABASE_URL обязателен для migrate/dev/seed на стенде (compose-переменная)
 * или в services/notification/.env (dotenv); для `prisma generate` (нужен в CI)
 * значение не требуется.
 */
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://svc_notification:svc_notification_pw@localhost:5432/db_notification';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
