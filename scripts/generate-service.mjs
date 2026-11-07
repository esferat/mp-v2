#!/usr/bin/env node
/**
 * Генератор каркаса сервиса mp-v2 (задача 0.7).
 *
 * Сервисы идентичны по структуре (fsd.md §4): расхождение деревьев = правка
 * шаблона, а не ручная правка семи копий. Эталон по наполнению — services/catalog.
 *
 * Использование:
 *   node scripts/generate-service.mjs identity \
 *     --desc "Идентичность и доступ" --db db_identity --port 4001
 *   node scripts/generate-service.mjs notification \
 *     --desc "Уведомления" --port 4007            # без БД, только RabbitMQ
 *   node scripts/generate-service.mjs gateway \
 *     --desc "API-шлюз" --port 4000 --no-rabbit    # без БД и брокера
 *
 * Флаги:
 *   --db <name>     имя БД (например db_identity); включает Prisma, outbox/inbox
 *   --port <n>      порт по умолчанию
 *   --desc <text>   описание сервиса
 *   --no-rabbit     без RabbitMQ/outbox (по умолчанию брокер включён)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const templateDir = path.join(scriptsDir, 'service-template');

// ---------------------------------------------------------------- аргументы
const [name, ...rest] = process.argv.slice(2);
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error(
    'Ожидается имя сервиса (kebab-case): node scripts/generate-service.mjs <name> [--db db_x] [--port N] [--desc T] [--no-rabbit]',
  );
  process.exit(1);
}

const flags = { db: null, port: null, desc: name, rabbit: true };
for (let i = 0; i < rest.length; i += 1) {
  const arg = rest[i];
  if (arg === '--db') flags.db = rest[++i];
  else if (arg === '--port') flags.port = Number(rest[++i]);
  else if (arg === '--desc') flags.desc = rest[++i];
  else if (arg === '--no-rabbit') flags.rabbit = false;
  else if (arg === '--no-db') flags.db = null;
  else {
    console.error(`Неизвестный аргумент: ${arg}`);
    process.exit(1);
  }
}
if (!Number.isInteger(flags.port)) {
  console.error('Укажите --port <число> — порт по умолчанию для сервиса');
  process.exit(1);
}

const target = path.join(repoRoot, 'services', name);
if (fs.existsSync(target)) {
  console.error(`services/${name} уже существует — генерация отменена`);
  process.exit(1);
}

// ---------------------------------------------------------------- токены
const cap = name
  .split('-')
  .map((p) => p[0].toUpperCase() + p.slice(1))
  .join('');
const tokens = {
  NAME: name, // identity            — имя сервиса
  PKG: `@mp/${name}`, // @mp/identity         — имя пакета
  CAP: cap, // Identity             — для getIdentityEnv
  DESC: flags.desc, // описание в package.json
  PORT: String(flags.port),
  DB: flags.db ?? '',
  // пользователь БД из postgres/init/01-init.sh: db_identity → svc_identity
  DB_USER: flags.db ? flags.db.replace(/^db_/, 'svc_') : '',
};

/** Долгие блоки кода, зависящие от флагов. */
function block(nameParts) {
  const hasDb = Boolean(flags.db);
  const hasRabbit = flags.rabbit;
  const out = {};

  // package.json: скрипты Prisma появляются только при БД
  out.DB_SCRIPTS = hasDb
    ? `,\n    "gen": "prisma generate",\n    "db:migrate": "prisma migrate deploy",\n    "db:migrate:dev": "prisma migrate dev",\n    "db:seed": "tsx prisma/seed.ts"`
    : '';
  out.TSC_SCRIPTS = hasDb ? ' && tsc -p tsconfig.scripts.json --noEmit' : '';
  // зависимости Prisma: держим только там, где у сервиса есть БД
  out.PRISMA_DEPS = hasDb
    ? `,\n    "@prisma/adapter-pg": "^7.10.1",\n    "@prisma/client": "^7.10.1",\n    "pg": "^8.23.1"`
    : '';
  out.PRISMA_DEV_DEPS = hasDb
    ? `,\n    "dotenv": "^18.0.9",\n    "prisma": "7.10.1",\n    "tsx": "^4.23.15"`
    : '';
  // тест: fail-fast DATABASE_URL — только когда сервис читает её из окружения
  out.ENV_TESTS = hasDb
    ? `

  it('требует DATABASE_URL (fail-fast на старте)', () => {
    expect(() => load${cap}Env({ SERVICE_NAME: '${name}' })).toThrow(/DATABASE_URL/);
  });`
    : '';
  // minimal-окружение: db-сервису нужен ещё DATABASE_URL, иначе упадёт первый тест
  out.TEST_MINIMAL = hasDb
    ? ",\n      DATABASE_URL: 'postgresql://svc_user:pw@localhost:5432/db_x'"
    : '';

  // Dockerfile: генерация Prisma Client нужна только при БД
  out.DOCKER_GEN = hasDb ? `  && pnpm --filter ${tokens.PKG} gen \\\n` : '';

  // app.module.ts: инфраструктурные модули по флагам
  const infra = [];
  if (hasRabbit) {
    infra.push(`    RabbitModule.forRoot({
      url: env.RABBITMQ_URL,
      exchange: env.RABBITMQ_EXCHANGE,
      dlxExchange: env.RABBITMQ_DLX_EXCHANGE,
      prefetch: env.RABBITMQ_PREFETCH,
    }),`);
  }
  if (hasDb) {
    infra.push(`    OutboxModule.forRootAsync({
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => ({
        // Событие пишется в той же транзакции, что и изменение (0.9)
        store: createPrismaOutboxStore(prisma.outboxMessage),
        intervalMs: env.OUTBOX_INTERVAL_MS,
        batchSize: env.OUTBOX_BATCH_SIZE,
        maxAttempts: env.OUTBOX_MAX_ATTEMPTS,
      }),
    }),
    SharedApiModule.forRoot(),`);
  }
  out.MODULE_IMPORTS = infra.length ? `\n${infra.join('\n')}\n  ` : '';

  // imports в app.module.ts (из @mp/service-kit и shared/api)
  const kitImports = ['applyTraceIdMiddleware', 'AuthModule', 'JwtAuthGuard', 'LoggerModule'];
  if (hasRabbit) kitImports.push('RabbitModule');
  if (hasDb) kitImports.push('OutboxModule', 'createPrismaOutboxStore');
  out.KIT_IMPORTS = kitImports.join(', ');
  out.SHARED_API_IMPORT = hasDb
    ? "import { PrismaService, SharedApiModule } from '../shared/api';\n"
    : '';

  // features/health/checks.ts: импорты зависимостей, которых нет в базовом шаблоне
  const checkImports = [];
  if (hasDb) checkImports.push("import { PrismaService } from '../../shared/api';");
  if (hasRabbit) checkImports.push("import { RabbitService } from '@mp/service-kit';");
  out.CHECKS_IMPORTS = checkImports.length ? `${checkImports.join('\n')}\n` : '';

  // shared/config/env.ts: поле DATABASE_URL только при БД
  out.ENV_SCHEMA_FIELDS = hasDb
    ? `  /** URL своей БД: доступ только к ${flags.db} (architecture.md §5). */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),`
    : '  // Сервис без собственной БД — специфичных переменных нет (0.7)';

  // features/health/checks.ts: проверки зависимостей
  const checks = [];
  if (hasDb) {
    checks.push(`    this.registry.register({
      name: 'postgres',
      check: async () => {
        await this.prisma.$queryRaw\`SELECT 1\`;
      },
    });`);
  }
  if (hasRabbit) {
    checks.push(`    this.registry.register({
      name: 'rabbitmq',
      check: async () => {
        if (!this.rabbit.isReady()) {
          throw new Error('нет соединения с RabbitMQ');
        }
      },
    });`);
  }
  out.HEALTH_CHECKS = checks.length
    ? `\n${checks.join('\n\n')}\n`
    : '\n    // Зависимостей пока нет: /readyz отвечает 200, как только появятся (0.7)\n';
  out.HEALTH_DEPS = [
    hasDb ? '    private readonly prisma: PrismaService,' : null,
    hasRabbit ? '    private readonly rabbit: RabbitService,' : null,
  ]
    .filter(Boolean)
    .join('\n');

  // main.ts: порядок импортов ядра
  out.MAIN_IMPORTS = "import { createLogger, traceIdMiddleware } from '@mp/service-kit';";

  void nameParts;
  return out;
}
const blocks = block();

/** Применяет {{токены}} к содержимому файла. */
function applyTokens(text) {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    if (key in tokens) return tokens[key];
    if (key in blocks) return blocks[key];
    return match;
  });
}

// ---------------------------------------------------------------- копирование
/** Файлы, которые не нужны сервису без БД. */
function skipByFlags(relPath) {
  if (flags.db) return false;
  const dbOnly = [
    'tsconfig.scripts.json',
    'prisma.config.ts',
    'prisma/schema.prisma',
    'prisma/seed.ts',
    'src/shared/api/prisma.service.ts',
    'src/shared/api/index.ts',
  ];
  return dbOnly.some((p) => relPath === p || relPath.startsWith(`${p}/`));
}

function copyDir(from, to, prefix = '') {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const src = path.join(from, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, path.join(to, entry.name), rel);
      continue;
    }
    if (skipByFlags(rel)) continue;
    const dest = path.join(to, entry.name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, applyTokens(fs.readFileSync(src, 'utf8')), 'utf8');
  }
}

copyDir(templateDir, target);

console.log(
  `Создан services/${name} (порт ${flags.port}, БД: ${flags.db ?? 'нет'}, RabbitMQ: ${flags.rabbit ? 'да' : 'нет'})`,
);
console.log('Следующие шаги:');
console.log(
  `  1. pnpm --filter ${tokens.PKG} gen        # Prisma Client${flags.db ? '' : ' (не требуется)'}`,
);
console.log(`  2. pnpm --filter ${tokens.PKG} typecheck`);
console.log(`  3. pnpm --filter ${tokens.PKG} lint && pnpm --filter ${tokens.PKG} test`);
if (flags.db)
  console.log(
    '  4. начальная миграция: npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script',
  );
