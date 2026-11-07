import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test, type INestApplication } from '@nestjs/testing';
import supertest from 'supertest';
import {
  TOKEN_VERIFIER,
  type TokenClaims,
  type TokenVerifier,
} from '../src/entities/authorization';
import { RATE_LIMITERS, type RateLimiters } from '../src/features/authorize';

/**
 * Интеграционный тест gateway (1.2): маршрутизация на мок-бэкенд,
 * 401/403/404/429 в едином формате ApiError, проброс x-request-id.
 * PostgreSQL/RabbitMQ не нужны — сервис их не использует.
 */

// Фейковый верификатор: роль кодируется в самом токене
class FakeVerifier implements TokenVerifier {
  async verify(bearer: string): Promise<TokenClaims> {
    if (bearer === 'Bearer expired')
      throw Object.assign(new Error('Токен просрочен'), { code: 'TOKEN_EXPIRED' });
    const roles = bearer.includes('admin')
      ? (['ADMIN'] as const)
      : bearer.includes('doctor')
        ? (['DOCTOR'] as const)
        : (['USER'] as const);
    return {
      sub: 'u-test',
      roles: [...roles],
      issuer: 'test',
      expiresAt: new Date('2030-01-01'),
    };
  }
}

const allowAll: RateLimiters = {
  auth: { take: () => ({ allowed: true, retryAfterSec: 0 }) },
  api: { take: () => ({ allowed: true, retryAfterSec: 0 }) },
};
const denyAll: RateLimiters = {
  auth: { take: () => ({ allowed: false, retryAfterSec: 1 }) },
  api: { take: () => ({ allowed: false, retryAfterSec: 1 }) },
};

let backend: Server;
let backendPort = 0;
let app: INestApplication;

beforeAll(async () => {
  // Мок-бэкенд: эхо метода, пути и заголовка trace-id
  backend = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        method: req.method,
        url: req.url,
        traceId: req.headers['x-request-id'] ?? null,
        authorization: req.headers.authorization ?? null,
      }),
    );
  });
  await new Promise<void>((resolve) => backend.listen(0, '127.0.0.1', resolve));
  backendPort = (backend.address() as AddressInfo).port;

  // SERVICE_URLS должен быть известен ДО первого обращения к getGatewayEnv:
  // все сервисы указываем на мок-бэкенд (в тесте важна маршрутизация, не сервисы)
  process.env.SERVICE_NAME = 'gateway';
  const services = [
    'catalog',
    'auth',
    'scheduling',
    'identity',
    'patient',
    'file',
    'report',
    'notification',
  ];
  process.env.SERVICE_URLS = services
    .map((name) => `${name}=http://127.0.0.1:${backendPort}`)
    .join(',');
  process.env.RATE_LIMIT_API = '1000';
  process.env.RATE_LIMIT_AUTH = '1000';

  const { AppModule } = await import('../src/app/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TOKEN_VERIFIER)
    .useValue(new FakeVerifier())
    .overrideProvider(RATE_LIMITERS)
    .useValue(allowAll)
    .compile();

  app = moduleRef.createNestApplication();
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await new Promise<void>((resolve) => backend.close(() => resolve()));
});

describe('маршрутизация /api/<service>/**', () => {
  it('проксирует на сервис, сохраняя полный путь и query', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/catalog/specializations?active=1')
      .set('Authorization', 'Bearer user-token')
      .expect(200);

    expect(response.body).toMatchObject({
      method: 'GET',
      // Сервисы живут под префиксом /api/<service> — путь сохраняется целиком
      url: '/api/catalog/specializations?active=1',
    });
  });

  it('пробрасывает Authorization и проставляет x-request-id', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/catalog/doctors')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body.authorization).toBe('Bearer admin-token');
    expect(response.body.traceId).toBeTruthy();
  });

  it('сохраняет пришедший от nginx x-request-id (цепочка в логах)', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/catalog/doctors')
      .set('Authorization', 'Bearer admin-token')
      .set('x-request-id', 'trace-from-nginx')
      .expect(200);

    expect(response.body.traceId).toBe('trace-from-nginx');
    expect(response.headers['x-request-id']).toBe('trace-from-nginx');
  });

  it('проксирует JSON-тело POST', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/scheduling/appointments')
      .set('Authorization', 'Bearer user-token')
      .send({ slotId: 's-1' })
      .expect(200);

    expect(response.body.method).toBe('POST');
    expect(response.body.url).toBe('/api/scheduling/appointments');
  });

  it('неизвестный сервис → 404 SERVICE_NOT_FOUND', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/nosuch/thing')
      .set('Authorization', 'Bearer admin-token')
      .expect(404);

    expect(response.body).toMatchObject({ code: 'SERVICE_NOT_FOUND' });
    expect(response.body.requestId).toBeTruthy();
  });
});

describe('авторизация (AC 1.2)', () => {
  it('без токена → 401 UNAUTHORIZED', async () => {
    const response = await supertest(app.getHttpServer()).get('/api/catalog/doctors').expect(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('просроченный токен → 401 TOKEN_EXPIRED', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/catalog/doctors')
      .set('Authorization', 'Bearer expired')
      .expect(401);
    expect(response.body).toMatchObject({ code: 'TOKEN_EXPIRED' });
  });

  it('USER на админском маршруте → 403 FORBIDDEN', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/catalog/doctors')
      .set('Authorization', 'Bearer user-token')
      .expect(403);
    expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('DOCTOR на админском маршруте → 403 FORBIDDEN', async () => {
    await supertest(app.getHttpServer())
      .get('/api/catalog/doctors')
      .set('Authorization', 'Bearer doctor-token')
      .expect(403);
  });

  it('ADMIN проходит на админский маршрут → 200', async () => {
    await supertest(app.getHttpServer())
      .get('/api/catalog/doctors')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);
  });

  it('health-эндпоинты контейнера публичны (healthcheck compose)', async () => {
    await supertest(app.getHttpServer()).get('/healthz').expect(200);
  });

  it('публичный /api/auth/register проходит без токена', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'a@b.c' })
      .expect(200);
    expect(response.body.url).toBe('/api/auth/register');
  });

  it('публичный /api/identity/register (сага 1.4) проходит без токена', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/identity/register')
      .send({ email: 'a@b.c' })
      .expect(200);
    expect(response.body.url).toBe('/api/identity/register');
  });

  it('GET /api/identity/register при этом остаётся требующим токен (нет политики public на GET)', async () => {
    await supertest(app.getHttpServer()).get('/api/identity/register').expect(401);
  });
});

describe('rate-limit → 429, не 500 (AC 1.2)', () => {
  it('отказ лимитера даёт 429 в формате ApiError', async () => {
    const { AppModule } = await import('../src/app/app.module');
    const limited = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(new FakeVerifier())
      .overrideProvider(RATE_LIMITERS)
      .useValue(denyAll)
      .compile();
    const limitedApp = limited.createNestApplication();
    await limitedApp.init();

    const response = await supertest(limitedApp.getHttpServer())
      .get('/api/catalog/specializations')
      .set('Authorization', 'Bearer user-token')
      .expect(429);

    expect(response.body).toMatchObject({ code: 'RATE_LIMITED' });
    expect(response.body.requestId).toBeTruthy();

    await limitedApp.close();
  });
});
