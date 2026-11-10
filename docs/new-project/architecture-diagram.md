# Графические схемы архитектуры

Визуальное дополнение к [architecture.md](architecture.md) (вариант C). Схемы в Mermaid: открываются в GitHub, VS Code
(превью Markdown) и любом Mermaid-рендерере.

| Схема                                                                            | Что показывает                                                                          |
|----------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| [1. Общая схема](#1-общая-схема-взаимодействия-сервисов)                         | Путь запроса: браузер → nginx → web/gateway → сервисы → данные, Keycloak, наблюдаемость |
| [2. Взаимодействие сервисов](#2-взаимодействие-сервисов-между-собой)             | Межсервисные REST-вызова, файлы и presigned, JWKS                                       |
| [3. Сценарий записи на приём](#3-сценарий-записи-на-приём-бронирование--статусы) | Бронирование через BFF, 409 при гонке, подтверждение админом, события                   |
| [4. Карта событий](#4-карта-событий-rabbitmq)                                    | Продьюсеры → exchange → потребители                                                     |

---

## 1. Общая схема взаимодействия сервисов

```mermaid
flowchart TB
    B["Браузер<br/>портал · админка · кабинет врача"]

    subgraph EDGE["Ребро — nginx"]
        direction LR
        NG["nginx<br/>TLS/HSTS в прод, HTTP в dev<br/>x-request-id · rate-limit · gzip<br/>/ и /api/bff/* и /api/auth/* → web<br/>/api/* → gateway<br/>/media/* → MinIO"]
    end

    subgraph APP["Приложения"]
        direction LR
        WEB["web — Next.js (App Router)<br/>SSR-страницы · BFF /api/bff/*<br/>серверные гарды · Auth.js"]
        GW["gateway — NestJS<br/>JWT по JWKS · роли ADMIN/USER/DOCTOR<br/>rate-limit · маршрутизация · trace-id"]
    end

    KC["Keycloak<br/>реалм medical-portal<br/>OIDC для web · client-credentials для сервисов<br/>роли ADMIN / USER / DOCTOR"]

    subgraph SVC["Доменные сервисы — NestJS + Prisma, FSD, MVC + Hexagonal"]
        direction LR
        IDN["identity"]
        CA["catalog"]
        PA["patient"]
        FI["file"]
        SC["scheduling"]
        RP["report"]
        NO["notification"]
    end

    subgraph DATA["Данные — своя БД и свой пользователь на сервис"]
        direction LR
        PG[("PostgreSQL<br/>db_identity · db_catalog · db_patients<br/>db_files · db_schedule · db_report")]
        MQ[("RabbitMQ<br/>topic exchange medical.events<br/>outbox → relay · inbox · DLQ")]
        S3[("MinIO<br/>patient-photos · doctor-photos · patient-docs")]
    end

    subgraph OBS["Наблюдаемость"]
        direction LR
        FB["Filebeat"]
        ES["Elasticsearch"]
        KB["Kibana<br/>поиск по traceId, дашборды, алерты"]
    end

    B -->|"HTTP/HTTPS"| NG
    NG --> WEB
    NG --> GW

    WEB -->|"OIDC-вход/выход"| KC
    WEB -->|"внутренний REST + JWT"| GW
    GW --> SVC

    SVC -.->|"JWKS / client-credentials"| KC
    SVC --> PG
    FI --> S3

    MQ --> RP
    MQ --> NO

    SVC -.->|"stdout JSON-логи"| FB
    WEB -.->|"логи"| FB
    FB --> ES --> KB

    classDef edge fill:#e8f1fb,stroke:#3b82c4,color:#0b2d4d
    classDef app fill:#e6f6ef,stroke:#2f9e6e,color:#0b3a27
    classDef svc fill:#fdf3e3,stroke:#d99024,color:#4a3208
    classDef data fill:#f0ecfa,stroke:#7c5cd6,color:#2c1f5e
    classDef obs fill:#f6f7f9,stroke:#9aa4b2,color:#2b3340
    classDef ext fill:#fdeaea,stroke:#d45151,color:#4d1414

    class NG edge
    class WEB,GW app
    class IDN,CA,PA,FI,SC,RP,NO svc
    class PG,MQ,S3 data
    class FB,ES,KB obs
    class B,KC ext
```

**Как читать:**

- сплошные стрелки — синхронный REST, пунктирные — служебные связи (аутентификация, логи, аудит);
- браузер ходит **только** в `web` (`/`, `/api/bff/*`, `/api/auth/*`); прямые вызовы `gateway` из клиента запрещены
  ([fsd §6, №10](fsd.md#6-нарушения-типовые-блокирующие));
- сервисы общаются с `gateway` и между собой — схема [№2](#2-взаимодействие-сервисов-между-собой); асинхронно — через
  RabbitMQ [№4](#4-карта-событий-rabbitmq);
- каждый сервис — своя БД и свой пользователь PostgreSQL, чужие схемы не читаются.

---

## 2. Взаимодействие сервисов между собой

Синхронные межсервисные вызовы (все остальные связи — через события, схема №4):

```mermaid
flowchart LR
    subgraph SVC["Доменные сервисы"]
        direction TB
        IDN["identity<br/>саги, связки<br/>user↔patient / user↔doctor"]
        CA["catalog<br/>врачи, специализации,<br/>расписания"]
        PA["patient<br/>карточки пациентов"]
        FI["file<br/>реестр объектов, presigned,<br/>валидация типа и размера"]
        SC["scheduling<br/>слоты, брони, статусы,<br/>результаты приёма"]
    end

    KC["Keycloak"]
    S3[("MinIO")]
    B["Браузер"]

    IDN -->|"REST: сага регистрации —<br/>создать карточку пациента"| PA
    CA -->|"REST: создать учётную<br/>запись врача"| IDN
    FI -->|"REST: проверить связь<br/>«врач–пациент» (есть приём)"| SC
    SC -.->|"fallback: копия расписания<br/>устарела"| CA

    SVC -.->|"JWKS · client-credentials"| KC
    FI -->|"загрузка и чтение объектов"| S3
    S3 -->|"presigned URL, TTL 5 мин,<br/>отдаётся через /media/* (nginx)"| B

    classDef svc fill:#fdf3e3,stroke:#d99024,color:#4a3208
    classDef data fill:#f0ecfa,stroke:#7c5cd6,color:#2c1f5e
    classDef ext fill:#fdeaea,stroke:#d45151,color:#4d1414

    class IDN,CA,PA,FI,SC svc
    class S3 data
    class KC,B ext
```

Правила владения данными — [architecture §5](architecture.md#5-владение-данными): чужие БД не читаются, файлы отдаёт
только `file-service` (владелец / `ADMIN` / врач с приёмом — проверка связи через `scheduling`).

---

## 3. Сценарий записи на приём (бронирование → статусы)

```mermaid
sequenceDiagram
    participant B as Браузер
    participant N as nginx
    participant W as web (BFF/SSR)
    participant G as gateway
    participant S as scheduling
    participant Q as RabbitMQ
    participant NO as notification
    participant RP as report

    B->>N: POST /api/bff/scheduling/appointments
    N->>W: маршрут /api/bff/*
    W->>G: POST /api/scheduling/appointments (JWT, x-request-id)
    G->>S: guard роли, проверка токена, маршрутизация
    S->>S: одна транзакция — INSERT appointment (SUBMITTED) + строка outbox
    S->>S: уникальный индекс (doctorId, localDate, start)

    alt слот уже занят (гонка двойного клика)
        S-->>G: 409 SLOT_TAKEN
        G-->>W: 409
        W-->>B: тост «этот слот только что заняли», выбор не сбрасывается
    else слот свободен
        S-->>G: 201, id записи, статус SUBMITTED
        G-->>W: 201
        W-->>B: экран успеха «запись отправлена на подтверждение»
        S->>S: outbox-relay публикует событие
        S-->>Q: appointment.submitted.v1
        Q-->>NO: очередь q.notification.* (+ DLQ)
        NO-->>B: письмо пациенту (SMTP, Mailpit в dev)
    end

    Note over B,G: админ подтверждает запись
    B->>N: PUT /api/scheduling/appointments/{id}/status
    N->>W: маршрут /api/bff/*
    W->>G: PUT …/status со значением APPROVED
    G->>S: статусная машина — только из SUBMITTED
    S->>S: транзакция — статус APPROVED + строка outbox
    S-->>Q: appointment.approved.v1
    Q-->>NO: уведомление пациенту
    Q-->>RP: проекция отчёта — плюс одно посещение
    S-->>G: 200, обновлённый AppointmentResponseDTO
    G-->>W: 200
    W-->>B: строка таблицы обновляется, Chip «Принята»
```

Правила переходов и счётчиков
отчёта — [каноническая таблица статусной машины](functional-spec.md#статусная-машина-записи-канон).

---

## 4. Карта событий RabbitMQ

```mermaid
flowchart LR
    subgraph PROD["Продьюсеры — outbox в транзакции сервиса"]
        direction TB
        IDN["identity"]
        CA["catalog"]
        PA["patient"]
        FI["file"]
        SC["scheduling"]
    end

    EX[("topic exchange medical.events<br/>routing key: domain.event.v1")]

    subgraph CONSUMERS["Потребители — очереди с inbox-идемпотентностью"]
        direction TB
        NOT["notification<br/>письма"]
        REP["report<br/>проекция visits"]
        WEBR["web<br/>revalidate справочников"]
        AUD["audit<br/>после MVP"]
    end

    IDN -->|"user.registered · user.role-changed"| EX
    CA -->|"doctor.created · doctor.updated · doctor.deleted<br/>specialization.changed"| EX
    PA -->|"patient.created · patient.updated"| EX
    FI -->|"document.uploaded · document.deleted"| EX
    SC -->|"appointment.submitted · approved · declined<br/>appointment.cancelled · completed"| EX

    EX --> NOT
    EX --> REP
    EX --> WEBR
    EX -.-> AUD

    classDef prod fill:#fdf3e3,stroke:#d99024,color:#4a3208
    classDef cons fill:#e6f6ef,stroke:#2f9e6e,color:#0b3a27
    classDef ex fill:#f0ecfa,stroke:#7c5cd6,color:#2c1f5e

    class IDN,CA,PA,FI,SC prod
    class NOT,REP,WEBR,AUD cons
    class EX ex
```

Гарантии доставки: **at-least-once** (outbox + ретраи + DLQ), идемпотентность потребителей по `eventId` (таблица
`inbox`), replay из DLQ — [architecture §6.3](architecture.md#63-события-rabbitmq). Схемы полезной нагрузки — Zod в
`packages/contracts/events`.

---

## Технические детали схем

| Элемент      | Значение                                                                                                                                                                         |
|--------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Порты (dev)  | nginx `8080`/`80`, web `3000`, gateway `4000`, Keycloak `8180`, MinIO `9000`/`9001`, RabbitMQ `5672`/`15672`, Elasticsearch `9200`, Kibana `5601`, Mailpit `8025`/`1025`         |
| Домены (dev) | `portal.mp-kit.local`, `kibana.mp-kit.local`, `minio.mp-kit.local`, `mailpit.mp-kit.local`, `rabbitmq.mp-kit.local` (запись в hosts — см. [README репозитория](../../README.md)) |
| Токены       | наружу — JWT Keycloak (realm roles); внутри — тот же JWT или client-credentials; проверка локально по публичному ключу реалма                                                    |
| Контракты    | OpenAPI + Zod в `packages/contracts` → генерация TS-типов для `web` и `gateway`                                                                                                  |
| Логи         | pino (stdout, JSON) → Filebeat → Elasticsearch → Kibana; поиск по `traceId` = `x-request-id`                                                                                     |
