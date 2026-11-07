# mp-v2 — монорепозиторий нового медицинского портала

Код нового проекта (вариант архитектуры **C**). Документация живёт рядом: [`../docs/new-project/`](../docs/new-project/README.md) — обзор, [functional-spec.md](../docs/new-project/functional-spec.md) — бэклог, [architecture.md](../docs/new-project/architecture.md) — архитектура, [fsd.md](../docs/new-project/fsd.md) — обязательные конвенции кода.

## Структура

```
mp-v2/
├── apps/
│   └── web/                  # Next.js (App Router, SSR, BFF, Material UI)
├── services/                 # 8 сервисов NestJS + Prisma (по БД на сервис)
│   ├── gateway/              # api-gateway: JWT, роли, маршрутизация, trace-id
│   ├── identity/             # саги Keycloak, связки user↔patient/doctor
│   ├── catalog/              # врачи и специализации (эталон структуры сервиса)
│   ├── patient/ file/ scheduling/ report/ notification/
├── packages/
│   ├── contracts/            # Zod-схемы событий и DTO, routing keys, OpenAPI (codegen)
│   ├── service-kit/          # переиспользуемая инфраструктура: pino, trace-id, health, outbox/inbox, RabbitMQ
│   ├── eslint-config-fsd/    # общий ESLint-пресет: границы Feature-Sliced Design
│   └── tsconfig/             # общие пресеты TypeScript
├── scripts/
│   ├── generate-service.mjs  # генератор каркаса сервиса (структура идентична эталону)
│   └── service-template/     # его шаблон ({{токены}} подставляет генератор)
└── infra/                    # docker-compose, Keycloak-реалм, init-скрипты, nginx, filebeat
```

## Быстрый старт

```bash
cp .env.example .env          # единые dev-креды
pnpm install                  # зависимости
pnpm gen                      # генерация контрактов (OpenAPI) + Prisma Client
pnpm lint && pnpm typecheck && pnpm test
```

Инфраструктура и сервисы:

```bash
./infra/up.ps1                # compose up → ожидание health → таблица статусов
```

Новый сервис каркасом по эталону (`services/catalog`):

```bash
node scripts/generate-service.mjs <name> --desc "…" --db db_<name> --port <n>  # + --no-rabbit для gateway/notification
```

## Правила

- **FSD обязателен** во всех проектах ([fsd.md](../docs/new-project/fsd.md)); границы проверяет `pnpm lint` (eslint-plugin-boundaries).
- **BFF + SSR**: браузер ходит только в `/api/bff/*`, токен не покидает сервер `web`.
- **Контракты** — только из `@mp/contracts` (Zod): событие без схемы или локальный DTO = нарушение.
- **События** — через outbox (`packages/service-kit`), потребители идемпотентны (inbox).
- Секреты в `.env` (не коммитится); `.env.example` — только dev-значения.
