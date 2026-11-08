# mp-v2 — монорепозиторий нового медицинского портала

Код нового проекта (вариант архитектуры **C**). Документация лежит рядом с кодом: [`docs/new-project/`](docs/new-project/README.md) — обзор, [functional-spec.md](docs/new-project/functional-spec.md) — бэклог, [architecture.md](docs/new-project/architecture.md) — архитектура, [fsd.md](docs/new-project/fsd.md) — обязательные конвенции кода, [estimates.md](docs/new-project/estimates.md) — оценки трудозатрат.

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
├── docs/                     # документация проекта (спека, архитектура, FSD, макеты, оценки)
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

## Запуск через Docker

Весь стек живёт в Docker Compose: инфраструктура (PostgreSQL, Keycloak, RabbitMQ, MinIO, nginx, ELK, Mailpit), 8 сервисов и витрина `web`. Образы собирают код внутри себя — для чистого запуска локальный Node/pnpm не нужен (они нужны только для разработки и тестов).

### Первый запуск

```bash
# Windows PowerShell (рекомендуется): валидация конфига → up -d → ожидание health → таблица статусов
./infra/up.ps1

# macOS / Linux / WSL (флаг --no-nginx, таймаут через TIMEOUT=600)
./infra/up.sh
```

Скрипт подхватывает `.env` из корня репозитория, а если его нет — использует `.env.example` (dev-значения). Сам проверяет `docker compose config -q`, поднимает всё `-d` и ждёт healthcheck'и (по умолчанию 10 минут).

Тот же результат вручную (команды выполняются из корня `mp-v2/`):

```bash
docker compose --env-file .env.example -f infra/docker-compose.yml config -q   # валидация compose-конфигурации
docker compose --env-file .env.example -f infra/docker-compose.yml up -d       # подъём всего стека
docker compose --env-file .env.example -f infra/docker-compose.yml ps          # статус: сервис / состояние / health
```

Порядок зависимостей соблюдается сам: джобы `migrate-<сервис>` применяют Prisma-миграции до старта сервиса (`service_completed_successfully`), сервисы стартуют после health своих зависимостей (postgres, rabbitmq, keycloak), `nginx` — после `web` и `gateway`.

### Пересборка после изменения кода

```bash
docker compose --env-file .env.example -f infra/docker-compose.yml build web gateway
docker compose --env-file .env.example -f infra/docker-compose.yml up -d web gateway
# после пересборки web ОБЯЗАТЕЛЬНО пересоздать nginx: его DNS-кэш держит
# старый адрес контейнера, и без пересоздания все запросы уходят в 502
docker compose --env-file .env.example -f infra/docker-compose.yml up -d --force-recreate nginx
```

### Тема Keycloak (вход / регистрация / сброс пароля)

Страницы аутентификации оформляет кастомная тема `mp-portal` — пакет `packages/keycloak-theme` (Keycloakify: React-страницы Keycloak в стиле портала). Тема запекается в образ Keycloak (`infra/keycloak/Dockerfile` → `/opt/keycloak/providers/mp-portal.jar`), поэтому после правок в пакете пересобираются образ и контейнер:

```bash
pnpm --filter @mp/keycloak-theme build
docker compose --env-file .env.example -f infra/docker-compose.yml build keycloak
docker compose --env-file .env.example -f infra/docker-compose.yml up -d --force-recreate keycloak
```

JAR монтировать в контейнер нельзя: JVM держит его открытым, и переименование файла при следующей сборке темы падает с EPERM. Реалм ссылается на тему через `loginTheme: "mp-portal"` (`infra/keycloak/realm-medical-portal.json`; у живого реалма правится через Admin API — импорт работает только на пустой БД).

### Миграции Prisma

Новая миграция — папка `services/<svc>/prisma/migrations/<N>_<name>/migration.sql`; применяет её джоб `migrate-<svc>`:

```bash
docker compose --env-file .env.example -f infra/docker-compose.yml build migrate-scheduling
docker compose --env-file .env.example -f infra/docker-compose.yml run --rm migrate-scheduling
```

Важно: после добавления миграции джоб **обязательно пересобрать** — со старым образом он печатает «No pending» и ничего не применяет.

### Логи, остановка, сброс

```bash
docker compose --env-file .env.example -f infra/docker-compose.yml logs -f scheduling   # логи сервиса (json/pino)
docker compose --env-file .env.example -f infra/docker-compose.yml restart gateway      # перезапуск без пересборки
docker compose --env-file .env.example -f infra/docker-compose.yml down                # остановить (тома с данными сохраняются)
docker compose --env-file .env.example -f infra/docker-compose.yml down -v             # сброс СТОКА: БД, файлы MinIO, реалм Keycloak
```

### Порты (дефолты, переопределяются в `.env`)

| Сервис                 | Порт         | Назначение                                                                                               |
| ---------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| nginx                  | 80 / 8080    | единая точка входа: домены `*.mp-kit.local` (80), `localhost:8080`                                       |
| web                    | 3000         | Next.js напрямую (минуя nginx)                                                                           |
| gateway                | 4000         | API-gateway напрямую (минуя nginx)                                                                       |
| Keycloak               | 8180         | issuer токенов и страницы входа (**зафиксирован, не менять** — ломает проверку токенов во всех сервисах) |
| MinIO                  | 9000 / 9001  | S3 API / Console                                                                                         |
| PostgreSQL             | 5432         | по одной БД на сервис (`db_*`)                                                                           |
| RabbitMQ               | 5672 / 15672 | AMQP / Management                                                                                        |
| Elasticsearch / Kibana | 9200 / 5601  | логи pino → Filebeat → Kibana                                                                            |
| Mailpit                | 8025 / 1025  | dev-почта: UI / SMTP                                                                                     |

### Проверка после запуска

```bash
curl http://localhost:8080/healthz          # nginx → витрина
curl http://localhost:4000/healthz          # gateway
node scripts/seed-test-users.mjs            # dev-аккаунты (раздел «Тестовые аккаунты»)
node scripts/e2e-stage2.mjs                 # e2e-сценарии против запущенного стека
```

Журналы и метрики: `kibana.mp-kit.local` (dev без аутентификации), MinIO-файлы — `minio.mp-kit.local`.

## Домены UI (`*.mp-kit.local`)

Консоли и портал доступны по доменам на **порт80** (nginx, `NGINX_HTTP_PORT`):

| Домен                                  | Сервис                 |
| -------------------------------------- | ---------------------- |
| `portal.mp-kit.local` / `mp-kit.local` | портал (web)           |
| `kibana.mp-kit.local`                  | Kibana (логи/дашборды) |
| `minio.mp-kit.local`                   | MinIO Console (файлы)  |
| `mailpit.mp-kit.local`                 | Mailpit (dev-почта)    |
| `rabbitmq.mp-kit.local`                | RabbitMQ Management    |

Запись в `C:\Windows\System32\drivers\etc\hosts` (от администратора):

```hosts
127.0.0.1 mp-kit.local portal.mp-kit.local kibana.mp-kit.local minio.mp-kit.local mailpit.mp-kit.local rabbitmq.mp-kit.local
```

Примечания:

- **`AUTH_URL` не задаётся** — Auth.js берёт origin из запроса (`trustHost`), иначе вход всегда уводил бы на `localhost`;
  в route-хендлере `app/api/auth/[...nextauth]/route.ts` origin восстанавливается из `X-Forwarded-*`/`Host` (Next standalone строит `request.url` из `HOSTNAME` контейнера).
- Домены портал/апекс прописаны в `redirectUris` клиента `next-web` (манифест `infra/keycloak/realm-medical-portal.json`; в живой реалм — через Admin API, импорт не перезаписывает).
- **Keycloak сознательно без домена**: `KC_HOSTNAME` зафиксирован на `http://localhost:8180` — issuer в токенах должен быть стабильным для проверки всеми сервисами; страницы логина доступны на `http://localhost:8180`.
- Доступ без hosts сохраняется: `http://localhost:8080` (nginx) и `http://localhost:3000` (web напрямую).

## Тестовые аккаунты (dev)

Один пароль у всех: **`Password123!`**. Источник имён/ролей — манифест
`infra/keycloak/realm-medical-portal.json` (создаётся при свежем импорте реалма);
для уже запущенного реалма прогоняется `node scripts/seed-test-users.mjs`
(идемпотентен: создаёт недостающих пользователей и их карточки Patient/Doctor).

| Вход               | Роль   | Что есть сразу                                                              |
| ------------------ | ------ | --------------------------------------------------------------------------- |
| `admin@test.mp`    | ADMIN  | админка: врачи, специализации, пациенты, управление записями, отчёты        |
| `admin1@test.mp`   | ADMIN  | второй админ (проверка, что роль, а не личность, определяет доступ)         |
| `admin2@test.mp`   | ADMIN  | третий админ (негативные проверки: не USER/DOCTOR-маршруты)                 |
| `patient@test.mp`  | USER   | личный кабинет: запись, история, профиль, документы                         |
| `patient1@test.mp` | USER   | карточка пациента создана, профиль/история работают                         |
| `patient2@test.mp` | USER   | карточка пациента создана (второй пациент для проверки чужих данных)        |
| `doctor@test.mp`   | DOCTOR | кабинет врача: `/doctor/schedule`, `/doctor/patients` (карточка с `userId`) |
| `doctor1@test.mp`  | DOCTOR | карточка врача с привязкой `sub → doctorId` (9.1), слоты и приёмы           |
| `doctor2@test.mp`  | DOCTOR | карточка врача с привязкой (для проверки «чужой врач не видит чужое»)       |

Проверка ролей в токене (dev):

```bash
# password-grant + расшифровка ролей (ожидается ADMIN/USER/DOCTOR)
curl -s -X POST http://localhost:8180/realms/medical-portal/protocol/openid-connect/token \
  -d "grant_type=password&client_id=svc-e2e&client_secret=dev-e2e-secret" \
  -d "username=doctor1@test.mp&password=Password123!" | jq -r .access_token | \
  cut -d. -f2 | base64 -d 2>/dev/null | jq .realm_access.roles
```

Назначение ролей при «ручном» создании пользователя — в Keycloak Admin API
(`POST .../users/{id}/role-mappings/realm`); сага `POST /api/identity/doctors`
(9.1) делает это сама при создании врача из админки.

## Правила

- **FSD обязателен** во всех проектах ([fsd.md](docs/new-project/fsd.md)); границы проверяет `pnpm lint` (eslint-plugin-boundaries).
- **BFF + SSR**: браузер ходит только в `/api/bff/*`, токен не покидает сервер `web`.
- **Контракты** — только из `@mp/contracts` (Zod): событие без схемы или локальный DTO = нарушение.
- **События** — через outbox (`packages/service-kit`), потребители идемпотентны (inbox).
- Секреты в `.env` (не коммитится); `.env.example` — только dev-значения.
