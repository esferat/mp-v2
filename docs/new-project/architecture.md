# Архитектура — вариант C (выбран)

> **Графические схемы:** [architecture-diagram.md](architecture-diagram.md) — общая схема взаимодействия, межсервисные
> вызовы, сценарий записи на приём, карта событий RabbitMQ (Mermaid).

**Принято:** вариант C — «полные микросервисы с событийной моделью». Бэкенд-сервисы — **NestJS + TypeScript + Prisma**,
все проекты — **Feature-Sliced Design** ([fsd.md](fsd.md)).

Варианты A (модульный монолит) и B (микросервисы по bounded context) рассматривались и отклонены как этапы целевой
архитектуры: команда сразу строит C, но **доставляет его поэтапно** (см. [roadmap.md](roadmap.md)) — сначала сервисы и
контракты, затем брокер/CQRS/уведомления.

## 1. Обоснование выбора

| Требование                   | Как закрывается в C                                               |
|------------------------------|-------------------------------------------------------------------|
| Независимые релизы           | Каждый сервис — свой контейнер, своя БД, свой пайплайн            |
| Изоляция отказов             | Падение отчётов/уведомлений не влияет на запись к врачу           |
| Уведомления и аудит          | События в RabbitMQ, потребители независимы от ядра                |
| Тяжёлая аналитика            | CQRS: `report-service` читает проекцию, не нагружая `db_schedule` |
| Масштабирование под нагрузку | Пиковые (запись) и тяжёлые (отчёт) нагрузки разделены             |

Цена выбора (принята осознанно): распределённые транзакции → саги; eventual consistency; эксплуатация брокера; контракты
между сервисами. Меры против — §7.

## 2. Стек

| Компонент        | Решение                                                                                                                                                                                 |
|------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Web              | **Next.js** (App Router, **SSR**, RSC) + React + TS strict, FSD; **BFF**: сервер `web` агрегирует вызовы gateway и отдаёт данные UI; UI — **Material UI** (тема, обёртки в `shared/ui`) |
| API-слой         | `gateway` — NestJS: валидация JWT, роли, rate-limit, агрегация, `x-request-id`                                                                                                          |
| Доменные сервисы | NestJS + TS strict + Prisma, FSD                                                                                                                                                        |
| События          | RabbitMQ: topic exchange `medical.dlx` → DLX, на каждую фичу очередь + DLQ                                                                                                              |
| Данные           | PostgreSQL — одна БД на сервис (`db_identity`, `db_catalog`, `db_patients`, `db_files`, `db_schedule`, `db_report`)                                                                     |
| Файлы            | MinIO: `patient-photos`, `doctor-photos`, `patient-docs`; доступ через presigned URL                                                                                                    |
| Идентичность     | Keycloak: реалм `medical-portal`, OIDC (web), client-credentials (сервисы)                                                                                                              |
| Контракты        | `packages/contracts`: OpenAPI + Zod-схемы событий → генерация TS-типов                                                                                                                  |
| Логи             | pino (JSON) → **Filebeat** → **Elasticsearch** → **Kibana**: поиск по `traceId`/`eventId`, дашборды, алерты на паттерны ошибок, ILM-ретеншн                                             |
| Инфраструктура   | Docker Compose, nginx (TLS/routing/static), quality gate в CI (ESLint/Prettier/tsc/тесты)                                                                                               |

## 3. Общая схема

```
                                 ┌───────────────────────────────────────────┐
   browser ────────HTTPS────────►│ nginx: TLS · /→web · /api/bff→web · /api→gw│
                                 │ static cache · gzip · rate-limit · req-id  │
                                 └──────────────┬───────────────┬────────────┘
                                                │               │
                                 ┌──────────────▼──┐   ┌────────▼────────────┐
                                 │ web (Next.js)   │   │ gateway (NestJS)    │
                                 │ BFF · SSR · UI  │   │ authz · agg · limit │
                                 └────────┬────────┘   └───┬───────────┬─────┘
                                          │ OIDC           │           │ внутренний REST + JWT
                                 ┌────────▼────────┐       │           │
                                 │    Keycloak     │◄──────┘           │
                                 └─────────────────┘                   │
      ┌───────────────┬───────────────┬───────────────┬────────────────┤
      ▼               ▼               ▼               ▼                │
┌───────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│ identity  │  │  catalog    │  │  patient    │  │  scheduling │       │
│ service   │  │  service    │  │  service    │  │  service    │       │
│ (NestJS)  │  │  (NestJS)   │  │  (NestJS)   │  │  (NestJS)   │◄──────┘
└─────┬─────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
      │               │                │                │  outbox-relay
      │               │                ▼                │
      │               │        ┌─────────────┐          │
      │               │        │file service │          │
      │               │        │ (NestJS)    │          │
      │               │        └──────┬──────┘          │
      │               │               │                 │
      └───────────────┴───────┬───────┴────────┬────────┘
                              ▼                ▼
                 ┌────────────────────────────────────────┐
                 │  RabbitMQ · topic exchange medical.events│
                 │  очереди + DLQ per consumer              │
                 └───────────────┬────────────────────────┘
                                 │
                    ┌────────────┴─────────────┐
                    ▼                          ▼
             ┌─────────────┐          ┌─────────────────┐
             │ notification│          │ report-service   │
             │ service     │          │ (CQRS read-model)│
             │ (SMTP)      │          │                  │
             └──────┬──────┘          └────────┬────────┘
                    │                          │
   ┌────────────────▼──────────────────────────▼────────────────────┐
   │  PostgreSQL: db_identity · db_catalog · db_patients · db_files  │
   │            db_schedule · db_report          │
   │  MinIO: patient-photos · doctor-photos · patient-docs           │
   └─────────────────────────────────────────────────────────────────┘
```

## 4. Состав сервисов

| Сервис                 | Ответственность                                                                                                                      | БД            | Вход                  | Выход                                     |
|------------------------|--------------------------------------------------------------------------------------------------------------------------------------|---------------|-----------------------|-------------------------------------------|
| `web`                  | UI (Next.js, FSD, Material UI через `shared/ui`), **SSR**-рендеринг, **BFF**-слой (агрегация gateway, маппинг под вид), сессия       | —             | nginx `/`             | gateway `/api`, Keycloak                  |
| `gateway`              | JWT-валидация, роли, rate-limit, агрегация, trace-id                                                                                 | —             | nginx `/api/*`        | REST сервисов                             |
| `identity-service`     | Пользователи в Keycloak, связки «user ↔ patient» и «user ↔ doctor», роли, саги регистрации                                           | `db_identity` | REST gateway          | события `user.*`, вызовы Keycloak/patient |
| `catalog-service`      | Врачи (вкл. `userId` учётной записи), специализации, расписания врачей                                                               | `db_catalog`  | REST gateway          | события `doctor.*`, `specialization.*`    |
| `patient-service`      | Карточки пациентов, история владения документами                                                                                     | `db_patients` | REST gateway          | события `patient.*`                       |
| `file-service`         | Реестр объектов (вкл. категорию, автора), presigned URL, валидация типа/размера, проверка прав (владелец / `ADMIN` / врач с приёмом) | `db_files`    | REST gateway/сервисов | MinIO, события `document.*`               |
| `scheduling-service`   | Слоты, бронирование, статусы записей, **результаты приёма**, отмена                                                                  | `db_schedule` | REST gateway          | события `appointment.*`                   |
| `report-service`       | CQRS read-model, агрегаты посещений, экспорт                                                                                         | `db_report`   | REST gateway          | — (читает события)                        |
| `notification-service` | Email-уведомления по событиям                                                                                                        | —             | события               | SMTP (Mailpit в dev)                      |

**Внешние:** Keycloak, MinIO, PostgreSQL (инстансы), RabbitMQ, nginx.

### 4.1 Внутренняя архитектура сервиса: MVC + Hexagonal

Каждый бэкенд-проект (`gateway` и все `services/*`) изнутри строится как **MVC + Hexagonal Architecture (ports &
adapters)**. Это относится к коду сервиса и не меняет распределённую схему (вариант C, §3).

```
                 ┌─────────────────── ядро (domain) ───────────────────┐
 HTTP/событие    │  entities/      доменные правила, статусные машины │
  (вход)         │  features/*/app      use-case (команда/запрос)      │
    │            │  entities/repository  ПОРТЫ (интерфейсы)            │
    ▼            └──────────────▲──────────────────▲───────────────────┘
┌──────────────┐               │                  │
│ MVC:          │   вызов       │ реализация       │ реализация
│ Controller    │──────────────►│ (Prisma-репо,    │ (publisher брокера,
│ (валидация,   │               │  Keycloak, SMTP) │  consumer, outbox)
│  маппинг)     │               └──────────────────┘
└──────┬───────┘                        ▲
       │ view                           │ адаптеры (infrastructure)
       ▼                                │
  JSON-ответ / DTO              shared/api + prisma/
```

**MVC:**

- **Model** — use-case'ы (`features/*/app`) и домен (`entities`): единственное место бизнес-логики.
- **View** — маппинг результата в response-DTO (`features/*/api`); view не содержит ветвлений бизнеса.
- **Controller** — точка входа: DTO + валидация (pipe), вызов use-case, выбор view. Только адаптер, без логики
  (см. [fsd.md §4.2](fsd.md#42-правила-для-бэкенда)).

**Hexagonal (ports & adapters):**

- **Ядро** (`entities`, `features/*/app`) не знает про HTTP, Prisma, RabbitMQ и Keycloak — только порты (интерфейсы в
  `entities/repository` и `shared/model`).
- **Входные адаптеры (driving):** REST-controller, consumers событий, CLI/jobs — вызывают ядро.
- **Выходные адаптеры (driven):** Prisma-репозитории, publisher брокера, Keycloak Admin API, SMTP — реализуют порты и
  живут в `shared/api` (или `features/*/lib` для частных).
- **Сборка зависимостей** — только в `app` (composition root, DI-модули NestJS).

Почему так: домен тестируется без БД и брокера (in-memory-реализации портов), замена Prisma/SMTP/транспорта не трогает
бизнес-логику, SOLID-D и «зависимости направлены внутрь» исполняются механически. Соответствие слоёв FSD ↔
MVC/Hexagonal — таблица в [fsd.md §4.4](fsd.md#44-mvc--hexagonal-соответствие-слоям-fsd).

## 5. Владение данными

| Данные                                                 | Владелец             | Кто читает                                                                                                                             |
|--------------------------------------------------------|----------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Пользователи Keycloak, связка user↔patient             | `identity-service`   | gateway (через токен), scheduling (по `patientId` — нет, только по id из токена)                                                       |
| Врачи, специализации, расписания                       | `catalog-service`    | scheduling — **через событие-копию** расписания в `db_schedule`                                                                        |
| Карточки пациентов                                     | `patient-service`    | gateway (агрегация), identity (сага)                                                                                                   |
| Реестр файлов (ключ, бакет, владелец, категория, mime) | `file-service`       | patient/catalog — только свои ключи в своих карточках; выдача: владелец, `ADMIN`, **врач с приёмом** (проверка связи — в `scheduling`) |
| Записи, слоты, статусы, результаты приёма              | `scheduling-service` | report — через проекцию, не напрямую; кабинет врача и история пациента — по API                                                        |
| Проекция отчётов                                       | `report-service`     | —                                                                                                                                      |

Правила:

1. **Никто не читает чужую БД** — у каждого сервиса свой пользователь PostgreSQL с правами только на свою схему.
2. **Денализация по договорённости:** в `appointment` хранятся ФИО пациента/врача и `spec` — отчёт и список не ходят
   через сеть за справочниками. Источник истины для этих полей — событие `patient.updated`/`doctor.updated`.
3. **Копия расписания:** `scheduling-service` держит read-model расписания врачей, обновляемый событиями
   `doctor.schedule.changed`; при бронировании сверяется с ней (fallback — синхронный запрос к `catalog`).
4. **Связь «врач–пациент»** — производное правило `scheduling-service` (есть приём `APPROVED`/`COMPLETED`): именно оно
   открывает врачу доступ к документам пациента. `file-service` спрашивает об этом через API `scheduling` и правил
   доступа не хранит сам.

## 6. Взаимодействие

### 6.1 BFF и SSR (`web` как Backend for Frontend)

- **BFF:** браузер общается только с сервером `web`; он же — единственная точка входа в API. В `web` живут:
  - **Server Components / страницы** — данные для рендеринга запрашиваются на сервере `web` (внутренний вызов `gateway`,
    без раскрытия токена в браузер);
  - **Route Handlers / Server Actions** (`/api/bff/*`) — для клиентских интерактивных действий (формы, таблицы, мастер
    записи): агрегация нескольких вызовов gateway в один запрос, маппинг контрактов под вид UI, единая точка логирования
    и ошибок.
- **SSR обязателен:** контент страниц (списки, карточки, статусы) отдаётся отрендеренным с сервера; клиентская
  гидрация — только для интерактивных частей. Клиентский код не ходит в `gateway` напрямую — только в `/api/bff/*` и
  внутренние данные страницы.
- **Что делает BFF:** агрегация (один вызов страницы вместо 4–6 вызовов gateway), трансформация DTO → view-модели,
  скрытие внутренней структуры API, проброс `traceId`, серверный кэш справочников (revalidate по событиям
  `doctor.updated.v1` и др.).
- **Чего BFF не делает:** бизнес-логика и правила домена (это сервисы), владение данными, прямой доступ к чужим БД — BFF
  тонкий (KISS), иначе он превращается в монолит.
- **nginx:** `/`, `/api/bff/*` и `/api/auth/*` → `web:3000` (route handler Auth.js — OIDC-вход/выход); `/api/*` →
  `gateway:4000` (служебные/прямые вызовы, страницы его не используют).

### 6.2 Синхронный REST (внутренняя сеть)

- Только `gateway → сервисы` и, там где нужно, сервис → сервис (identity → patient, scheduling → catalog fallback,
  file → scheduling — связь «врач–пациент», catalog → identity — учётная запись врача).
- Контракты — OpenAPI в `packages/contracts`, TS-типы генерируются для web и gateway.
- Токен: наружу — JWT из Keycloak (realm roles); внутри — тоже JWT (client-credentials), сервисы проверяют его локально
  по публичному ключу реалма.
- Каждый запрос несёт `x-request-id`, генерируемый nginx.

### 6.3 События (RabbitMQ)

- Topic exchange **`medical.events`**, routing key вида `<domain>.<event>.<version>` (например,
  `appointment.submitted.v1`).
- У каждого потребителя — своя очередь `q.<service>.<event>`; ошибки → **DLQ** `q.<service>.dlq` (никаких бесконечных
  ретраев в основном потоке).
- **Публикация — через outbox:** сервис пишет «дело» и событие в одной транзакции PostgreSQL, outbox-relay ретраит
  доставку в брокер (exactly-once доставки нет — потребители **идемпотентны** по `eventId`).
- Потребитель записывает `eventId` в таблицу `inbox` — повтор события игнорируется.

### 6.4 Каталог событий

| Routing key                                                     | Производитель | Потребители                                                                                                         | Содержимое (кратко)                                                                                     |
|-----------------------------------------------------------------|---------------|---------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| `user.registered.v1`                                            | identity      | notification                                                                                                        | userId, email, locale                                                                                   |
| `user.role-changed.v1`                                          | identity      | notification, audit                                                                                                 | userId, roles                                                                                           |
| `patient.created.v1` / `patient.updated.v1`                     | patient       | scheduling (денализация), audit                                                                                     | patientId, ФИО, birthDate                                                                               |
| `doctor.created.v1` / `doctor.updated.v1` / `doctor.deleted.v1` | catalog       | scheduling (копия расписания; при удалении — удаление копии), web (revalidate ISR)                                  | doctorId, **userId**, status, schedule, spec (без `email` — PII, см. 10.2)                              |
| `specialization.changed.v1`                                     | catalog       | web (revalidate)                                                                                                    | specId, name                                                                                            |
| `document.uploaded.v1`                                          | file          | notification, audit                                                                                                 | key, bucket, ownerId, mime, size, category, uploadedBy                                                  |
| `document.deleted.v1`                                           | file          | audit                                                                                                               | key, ownerId                                                                                            |
| `appointment.submitted.v1`                                      | scheduling    | notification, audit                                                                                                 | appointmentId, patientId, doctorId, slot, ФИО                                                           |
| `appointment.approved.v1`                                       | scheduling    | notification, **report** (проекция: **+1**)                                                                         | то же + статус                                                                                          |
| `appointment.declined.v1`                                       | scheduling    | notification, audit                                                                                                 | то же + причина; **на счётчик проекции не влияет** (переход только из `SUBMITTED`)                      |
| `appointment.cancelled.v1`                                      | scheduling    | notification, **report** (проекция: **−1**, только если запись была `APPROVED`)                                     | appointmentId, previousStatus                                                                           |
| `appointment.rescheduled.v1`                                    | scheduling    | notification («запись перенесена», Этап 3), audit, **report** (перемещение счётчика между ячейками `(spec, месяц)`) | appointmentId, старый/новый слот, doctorId (был/стал), специализация (была/стала), patientId, инициатор |
| `appointment.completed.v1`                                      | scheduling    | notification, audit                                                                                                 | appointmentId, patientId, doctorId, ФИО (результат приёма внесён)                                       |

**Статусная машина и правила проекции:** каноническая таблица переходов (`SUBMITTED → APPROVED | DECLINED`,
`SUBMITTED/APPROVED → CANCELLED`, `APPROVED → COMPLETED`, **перенос** слота/врача из `SUBMITTED`/`APPROVED` без смены
статуса) и правило счётчиков отчёта (**+1** по `APPROVED`, **−1** по `CANCELLED` из `APPROVED`, **перенос из
`APPROVED`** — перемещение счётчика между ячейками `(spec, месяц)`, перенос из `SUBMITTED` — без эффекта; остальные
переходы счётчик не
меняют) — [functional-spec «Статусная машина записи (канон)»](functional-spec.md#статусная-машина-записи-канон). Правила
меняются только там, с синхронизацией каталога событий выше.

Схемы полезной нагрузки — Zod в `packages/contracts/events`, версионируются; несовместимое изменение = новая версия
routing key.

## 7. Ключевые сценарии

Ниже — путь вызова; с браузера все запросы идут через **BFF** `web` (`/api/bff/*`, §6.1), дальше — gateway и сервисы.

### 7.1 Регистрация (сага с компенсацией)

1. Браузер → `POST /api/bff/auth/register` (`web`) → `gateway` → `identity-service`.
2. Шаг A: создание пользователя в Keycloak (email подтверждён, роли `USER`).
3. Шаг B: `identity` вызывает `patient-service` — создаётся карточка с `userId`.
4. **Компенсация:** если шаг B не удался — `identity` удаляет пользователя Keycloak и отвечает 5xx; повтор запроса
   идемпотентен по `email` (повтор → успех или та же ошибка, без дублей).
5. Успех → событие `user.registered.v1` → письмо «Добро пожаловать».

### 7.2 Бронирование записи

1. `web` (процесс `booking-wizard`, BFF `/api/bff/scheduling/appointments`) → `POST /api/scheduling/appointments` →
   gateway (слот + patientId из токена).
2. `scheduling`: одна транзакция — INSERT с **уникальным индексом** `(doctorId, localDate, start)` поверх живых
   записей + строка в `outbox`.
  - Конфликт → **409** «слот занят» (защита от двойного клика и гонки двух пользователей).
3. Outbox-relay → `appointment.submitted.v1` → `notification-service` шлёт письмо пациенту.
4. Статус остаётся `SUBMITTED`, пока админ не примет решение.

### 7.3 Смена статуса (админ)

1. Браузер → BFF `web` → `PUT /api/scheduling/appointments/:id/status` `{APPROVED|DECLINED}`.
2. `scheduling`: статусная машина (переход только из `SUBMITTED`) → транзакция + outbox.
3. Событие → `notification-service` (письмо пациенту) и `report-service` (проекция: +1/−1 к счётчику посещений).

### 7.4 Отчёт (CQRS)

1. `report-service` консумит `appointment.*` и поддерживает проекцию: `visits(specId, year, month, count)` в
   `db_report`.
2. `GET /api/reports/visits?from&to` — чтение проекции (индексированный `GROUP BY`), пагинация, опционально CSV.
3. **Пересборка:** скрипт `report:rebuild` восстанавливает проекцию из событий (или из `db_schedule` как истины) —
   проекцию можно в любой момент выбросить и построить заново.

### 7.5 Загрузка документа

1. Браузер → BFF `web` → `POST /api/patient/:id/doc` (multipart) → `gateway` → `file-service`.
2. `file-service`: валидация MIME (JPEG/PNG/PDF) и размера (≤ 5 МБ) → загрузка в MinIO → запись в реестр (`ownerType`,
   `ownerId`) в `db_files` → событие `document.uploaded.v1`.
3. Скачивание: `GET /api/files/:key` → `file-service` проверяет **владельца** (или роль `ADMIN`) → presigned URL, TTL 5
   минут.

### 7.6 Доступ к файлам фото

`photoKey` хранится в карточке (`patient`/`doctor`), отдаётся через presigned URL, формируемый владеющим сервисом; nginx
дополнительно проксирует `/media/*` → MinIO для публичных (предпросмотр) объектов.

### 7.7 Результат приёма (кабинет врача)

1. Браузер → BFF `web` (`/api/bff/scheduling/appointments/:id/result`) → gateway (guard `DOCTOR`/`ADMIN`) →
   `scheduling-service`.
2. `scheduling`: проверки — запись назначена этому врачу (doctorId из токена), статус `APPROVED` → транзакция: вставка
   результата (unique по `appointmentId`) + статус `COMPLETED` + строка `outbox`.
3. Событие `appointment.completed.v1` → `notification-service` (письмо пациенту «приём завершён»), `audit`.
4. Пациент видит результат в истории записей (чтение через BFF, задача 5.5).

### 7.8 Документы: врач загружает и читает

1. Браузер → BFF `web` → `POST /api/patient/:id/doc` (роль `DOCTOR`) → gateway → `file-service`.
2. `file-service` → внутренний вызов `scheduling` (связь «врач–пациент»: есть приём `APPROVED`/`COMPLETED`) — без
   связи → **403**.
3. Валидация (магические байты, ≤ 5 МБ) → MinIO → реестр (`category`, `uploadedBy`) → событие `document.uploaded.v1`.
4. Скачивание: `GET /api/files/:key` → проверка: владелец, `ADMIN` **или** врач с подтверждённой связью → presigned URL,
   TTL 5 минут.

### 7.9 Перенос записи на другого врача / на другое время (админ)

1. Браузер → BFF `web` → `PUT /api/scheduling/appointments/:id/reschedule` `{doctorId?, localDate, start, reason?}`
   (guard `ADMIN`) → gateway → `scheduling`.
2. Проверки: запись в `SUBMITTED`/`APPROVED` (иначе **409**), врач активен и есть в копии расписания (5.1), новая дата
   не в прошлом.
3. Транзакция: `UPDATE` записи (слот, врач, денализованные ФИО/специализация) + строка `outbox` одним commit;
   `UNIQUE (doctorId, localDate, start)` → конфликт → **409 SLOT_TAKEN**.
4. Событие `appointment.rescheduled.v1` → `notification` («запись перенесена», Этап 3) и `audit`; **проекция отчёта не
   меняется** — посещение одно.
5. Пациент видит новое время в истории (5.5): запись одна, дублей и потери истории нет.

## 8. Аутентификация и авторизация

| Канал             | Механизм                                                                                                                                        |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| Браузер ↔ web     | Auth.js (OIDC) + Keycloak; сессия в HttpOnly/Secure-куках; SSR-страницы + `/api/bff/*` (route handlers), токен gateway не покидает сервер `web` |
| web ↔ gateway     | серверный вызов с JWT (из сессии) или внутренний токен web-сессии                                                                               |
| nginx ↔ всё       | TLS, HSTS (прод; в dev-стенде — HTTP), rate-limit на `/api/auth/*`                                                                              |
| gateway ↔ сервисы | JWT, проверка по публичному ключу реалма; роли `ADMIN`/`USER`/`DOCTOR` → guard                                                                  |
| сервис ↔ сервис   | client-credentials JWT (Keycloak), scope на операцию                                                                                            |
| Keycloak admin    | `identity-service` через Admin API (сервисный клиент)                                                                                           |

Роли — realm roles Keycloak: `ADMIN`, `USER`, `DOCTOR`. Границы:

- `web`: серверные гарды маршрутов (`/admin/**` → `ADMIN`, `/cabinet/**` → `USER`, `/doctor/**` → `DOCTOR`);
- `gateway`: отклоняет до доменных сервисов;
- сервис: собственный guard как последний рубеж (не доверять gateway вслепую).

## 9. Инфраструктура

### nginx

- `/` → `web:3000` (статика с кэшем по хэшу, **SSR** для страниц);
- `/api/bff/*` → `web:3000` (BFF route handlers: агрегация gateway, серверные вызовы);
- `/api/auth/*` → `web:3000` (route handler Auth.js `app/api/auth/[...nextauth]` — OIDC-вход/выход; без этого правила
  nginx уводил бы его в gateway);
- `/api/*` → `gateway:4000` (без кэша, таймауты, `proxy_set_header x-request-id`); страницы `web` используют только
  `/api/bff/*`;
- `/media/*` → MinIO (только presigned-пути);
- **TLS-терминация и HSTS — требование прода**; в dev-стенде nginx работает на HTTP (порт 80, публикация —
  `NGINX_HTTP_PORT`/`NGINX_PORT`, см. `mp-v2/.env.example`), сертификаты не выпускаются;
- сжатие, `limit_req` на auth-эндпоинты, `/healthz` (агрегированный).

### Docker Compose (стек)

Сервисы: `nginx`, `web`, `gateway`, 7 доменных сервисов, `keycloak`, `postgres`, `minio`, `rabbitmq`, `mailpit`
(dev-SMTP), `filebeat`, `elasticsearch`, `kibana`.

- **Тома** у postgres, minio, rabbitmq, keycloak, elasticsearch — обязательны (урок текущего проекта);
- healthcheck'и на всё, `depends_on: condition: service_healthy`;
- миграции Prisma выполняются job'ом до старта сервиса (`prisma migrate deploy`);
- env — через `.env`, секреты — Docker secrets в проде.

### Наблюдаемость

- **Терминология одного идентификатора:** nginx генерирует заголовок `x-request-id`; в логах pino и в ответах ошибок это
  же значение называется `requestId`/`traceId` — для поиска цепочки одного запроса в Kibana фильтроваться по `traceId`
  (поле документа лога);
- Структурированные логи (pino) c `service`, `traceId`, `eventId` — пишутся в stdout и через **Filebeat** попадают в
  **Elasticsearch**;
- **Kibana** (`:5601`) — просмотр и поиск: фильтры по `traceId`, `service`, `level`, `eventId`; сохранённые запросы и
  дашборды («ошибки за период», «лаг outbox», «DLQ»); алерты на паттерны ошибок (X-Pack alerting) и на 5xx-всплески;
- Ретеншн логов — **ILM-политика** (например, hot 7 дней → warm 30 дней → delete), индекс по дням; объём контролируется
  уровнем логов (prod: INFO, DEBUG — точечно);
- Метрики Prometheus per service (NestJS + prom-client): RPS, латентность, размер очередей, DLQ;
- Алерты: рост DLQ, лаг outbox-relay, 5xx rate, отсутствие heartbeat;
- Health: `/healthz` (liveness) + `/readyz` (готовность: БД, брокер).

## 10. Отказоустойчивость и согласованность

| Проблема                            | Механизм                                                                      |
|-------------------------------------|-------------------------------------------------------------------------------|
| Двойное бронирование                | Уникальный индекс в `db_schedule`, транзакционный INSERT                      |
| Потеря события                      | Outbox + ретраи + DLQ + ручной/автоматический replay                          |
| Повторная обработка                 | Идемпотентность по `eventId` (таблица `inbox`)                                |
| Несогласованность после отказа саги | Компенсация (удаление пользователя Keycloak), идемпотентные повторы           |
| Падение потребителя                 | Очередь переживает рестарт, сообщения не теряются (persistent)                |
| Каскадный отказ                     | Таймауты на вызовах, circuit breaker на межсервисных путях, отдельные пулы БД |
| Рассинхрон контрактов               | Единый `packages/contracts`, генерация типов, CI на совместимость             |

## 11. Что упрощается на MVP (без изменения целевой схемы)

1. `report-service` и `notification-service` запускаются позже остальных — до их появления `appointment.*` событий
   просто никто не слушает (exchange и outbox уже есть).
2. `gateway` на первом этапе — тонкий: валидация токена, маршрутизация, trace-id; rate-limit и агрегация добавляются
   позже.
3. Audit-потребитель не входит в MVP.
4. Kafka не используется: RabbitMQ покрывает нагрузку; миграция на Kafka — при росте потока событий (смена транспорта за
   контрактами не трогает домен).
