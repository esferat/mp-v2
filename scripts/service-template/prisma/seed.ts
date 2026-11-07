import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Seed сервиса {{NAME}} (0.8): идемпотентен — повторный запуск ничего не ломает.
 * Доменные данные сюда добавляются вместе с моделями (задачи эпиков).
 */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL обязателен для запуска seed');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const [outbox] = await Promise.all([prisma.outboxMessage.count()]);
    console.log(`[seed] {{NAME}}: строк в outbox — ${outbox} (доменных данных пока нет)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] ошибка:', error);
  process.exit(1);
});
