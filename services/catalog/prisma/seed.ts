import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Seed каталога (0.8): специализации и тестовые врачи для демо/e2e.
 * Идемпотентно — повторный запуск не создаёт дубликатов (upsert по ключам).
 */

const SPECIALIZATIONS = ['Терапевт', 'Хирург', 'Педиатр', 'Кардиолог', 'Невролог'] as const;

interface SeedDoctor {
  firstName: string;
  lastName: string;
  middleName?: string;
  specialization: string;
}

const DOCTORS: SeedDoctor[] = [
  { firstName: 'Иван', lastName: 'Петров', middleName: 'Сергеевич', specialization: 'Терапевт' },
  { firstName: 'Анна', lastName: 'Смирнова', middleName: 'Ивановна', specialization: 'Хирург' },
  { firstName: 'Ольга', lastName: 'Кузнецова', specialization: 'Педиатр' },
  {
    firstName: 'Дмитрий',
    lastName: 'Соколов',
    middleName: 'Алексеевич',
    specialization: 'Кардиолог',
  },
  { firstName: 'Елена', lastName: 'Волкова', specialization: 'Невролог' },
  { firstName: 'Сергей', lastName: 'Морозов', middleName: 'Павлович', specialization: 'Терапевт' },
];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL обязателен для запуска seed');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const specializationIds = new Map<string, string>();

    for (const name of SPECIALIZATIONS) {
      const nameLower = name.toLowerCase();
      const row = await prisma.specialization.upsert({
        where: { nameLower },
        update: { name },
        create: { name, nameLower },
      });
      specializationIds.set(name, row.id);
    }

    for (const doctor of DOCTORS) {
      const specializationId = specializationIds.get(doctor.specialization);
      if (!specializationId) {
        throw new Error(`Специализация «${doctor.specialization}» не найдена в seed`);
      }

      const existing = await prisma.doctor.findFirst({
        where: { firstName: doctor.firstName, lastName: doctor.lastName },
      });

      if (existing) {
        await prisma.doctor.update({
          where: { id: existing.id },
          data: { specializationId, middleName: doctor.middleName },
        });
      } else {
        await prisma.doctor.create({
          data: {
            firstName: doctor.firstName,
            lastName: doctor.lastName,
            middleName: doctor.middleName,
            specializationId,
            scheduleStart: '09:00',
            scheduleEnd: '17:00',
            durationMinutes: 30,
            workDays: [1, 2, 3, 4, 5],
          },
        });
      }
    }

    const [specializationsCount, doctorsCount] = await Promise.all([
      prisma.specialization.count(),
      prisma.doctor.count(),
    ]);

    console.log(`[seed] готово: специализаций — ${specializationsCount}, врачей — ${doctorsCount}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] ошибка:', error);
  process.exit(1);
});
