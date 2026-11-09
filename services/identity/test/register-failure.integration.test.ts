import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { APP_FILTER } from '@nestjs/core';
import { Test, type NestApplication } from '@nestjs/testing';
import request from 'supertest';
import { LOGGER, OutboxService, traceIdMiddleware, type Logger } from '@mp/service-kit';
import { ApiErrorFilter } from '../src/app/kernel';
import { RegisterController } from '../src/features/register/api/register.controller';
import { PATIENT_CARDS, USER_DIRECTORY } from '../src/entities/registration';
import { PatientHttpCards } from '../src/shared/api/patient.http.client';
import type { ClientCredentialsTokenCache } from '../src/shared/api/token-cache';
import { loadIdentityEnv } from '../src/shared/config';
import { FakeDirectory } from './helpers/fake-directory';

/**
 * Интеграционный тест обрыва на шаге B саги (1.4/AC):
 * «обрыв на шаге B (patients down) → после повтора ровно один пользователь
 * и одна карточка» + «500 с requestId» + «двойной submit → одна запись».
 *
 * В отличие от unit-теста с фейками здесь НАСТОЯЩИЙ HTTP-клиент patient-service
 * (PatientHttpCards) и НАСТОЯЩИЙ контроллер с ZodPipe/ApiErrorFilter/trace-id:
 * «down» = реальный ECONNREFUSED на закрытом порту; «up» = локальный стаб.
 * Keycloak подменён FakeDirectory — тест обязан проходить без инфраструктуры
 * (0.7 AC: без PostgreSQL/RabbitMQ/Keycloak).
 */

const testLogger = {
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
  fatal() {},
  silent() {},
  child() {
    return testLogger;
  },
} as unknown as Logger;

/** Стаб patient-service: считает создания, отдаёт карточку по userId. */
function startPatientStub(): Promise<{ server: Server; url: string; creates: () => number }> {
  const cardsByUser = new Map<string, string>();
  let creates = 0;

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const path = req.url ?? '';
      if (req.method === 'POST' && path === '/api/patient') {
        creates += 1;
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { userId?: string };
        const id = `pt-${creates}`;
        if (body.userId) cardsByUser.set(body.userId, id);
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id }));
        return;
      }
      const match = /^\/api\/patient\/by-user\/([^/]+)$/.exec(path);
      if (req.method === 'GET' && match) {
        const id = cardsByUser.get(decodeURIComponent(match[1] ?? ''));
        if (!id) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end('{}');
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id }));
        return;
      }
      res.writeHead(404).end();
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}`, creates: () => creates });
    });
  });
}

describe('Регистрация: обрыв на шаге B (1.4, интеграционный)', () => {
  let app: NestApplication;
  let directory: FakeDirectory;
  let stub: Awaited<ReturnType<typeof startPatientStub>> | null = null;
  const outboxEvents: string[] = [];
  /** Мутабельный env: между фазами переключаем patient-service «down» → «up». */
  let env: ReturnType<typeof loadIdentityEnv>;

  const body = {
    email: 'saga-b@test.mp',
    password: 'Password123!',
    firstName: 'Интеграционный',
    lastName: 'Тест',
    birthDate: '1990-01-01',
  };

  beforeEach(async () => {
    directory = new FakeDirectory();
    outboxEvents.length = 0;
    stub = null;
    // 127.0.0.1:1 — закрытый порт: мгновенный ECONNREFUSED (фаза «down»)
    env = loadIdentityEnv({
      SERVICE_NAME: 'identity',
      DATABASE_URL: 'postgresql://svc_identity:pw@localhost:5432/db_identity',
      PATIENT_SERVICE_URL: 'http://127.0.0.1:1',
      PATIENT_SERVICE_TIMEOUT_MS: 1500,
    });

    const tokens = {
      getToken: async () => 'test-access-token',
    } as unknown as ClientCredentialsTokenCache;

    const moduleRef = await Test.createTestingModule({
      controllers: [RegisterController],
      providers: [
        { provide: USER_DIRECTORY, useValue: directory },
        { provide: PATIENT_CARDS, useValue: new PatientHttpCards(env, tokens) },
        {
          provide: OutboxService,
          useValue: { enqueue: async (routingKey: string) => void outboxEvents.push(routingKey) },
        },
        { provide: LOGGER, useValue: testLogger },
        { provide: APP_FILTER, useClass: ApiErrorFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // trace-id middleware: ApiErrorFilter кладёт requestId из ALS (8.1/0.10)
    app.use(traceIdMiddleware);
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    await new Promise<void>((resolve) => (stub ? stub.server.close(() => resolve()) : resolve()));
    stub = null;
  });

  it('patient-service недоступен → 500 с requestId и без «висячего» пользователя', async () => {
    const response = await request(app.getHttpServer()).post('/api/identity/register').send(body);

    expect(response.status).toBe(500);
    expect(response.body.code).toBeTruthy();
    expect(response.body.message).toBeTruthy();
    expect(response.body.requestId).toBeTruthy(); // AC: 500 с requestId

    // Компенсация: пользователь Keycloak создан этой сагой и удалён
    expect(directory.users.size).toBe(0);
    expect(directory.deleteCalls).toHaveLength(1);
    // Событий нет: карточки не было — outbox молчит
    expect(outboxEvents).toEqual([]);
  });

  it('после восстановления patient-service повтор даёт ровно одного пользователя и одну карточку', async () => {
    const down = await request(app.getHttpServer()).post('/api/identity/register').send(body);
    expect(down.status).toBe(500);

    // «patient поднялся»
    stub = await startPatientStub();
    env.PATIENT_SERVICE_URL = stub.url;

    const up = await request(app.getHttpServer()).post('/api/identity/register').send(body);
    expect(up.status).toBe(201);
    expect(up.body).toMatchObject({ email: body.email, userId: expect.any(String) });

    expect(directory.users.size).toBe(1); // ровно один пользователь
    expect(stub.creates()).toBe(1); // ровно одна карточка (один POST к patient)
    expect(outboxEvents).toEqual(['user.registered.v1']); // событие ушло один раз
  });

  it('повторный submit той же формы идемпотентен (двойной клик → одна запись)', async () => {
    stub = await startPatientStub();
    env.PATIENT_SERVICE_URL = stub.url;

    const first = await request(app.getHttpServer()).post('/api/identity/register').send(body);
    const second = await request(app.getHttpServer()).post('/api/identity/register').send(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.userId).toBe(first.body.userId);
    expect(directory.users.size).toBe(1); // не задвоился
    expect(stub.creates()).toBe(1); // вторая карточка не создавалась
    expect(outboxEvents).toEqual(['user.registered.v1']); // событие не продублировано
  });
});
