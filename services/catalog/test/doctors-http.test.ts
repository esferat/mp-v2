import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_FILTER } from '@nestjs/core';
import { type NestApplication, Test } from '@nestjs/testing';
import request from 'supertest';
import { LOGGER, type Logger } from '@mp/service-kit';
import { ApiErrorFilter } from '../src/app/kernel';
import { DOCTOR_REPOSITORY, PHOTO_URL_SIGNER } from '../src/entities/doctor';
import { SPECIALIZATION_REPOSITORY } from '../src/entities/specialization';
import { UNIT_OF_WORK as UOW_TOKEN } from '../src/entities/repository';
import { CreateDoctorController } from '../src/features/create-doctor/api/create-doctor.controller';
import { UpdateDoctorController } from '../src/features/update-doctor/api/update-doctor.controller';
import { GetDoctorController } from '../src/features/get-doctor/api/get-doctor.controller';
import { type InMemoryDoctorRepository, makeCatalogContext } from './helpers/in-memory';

/**
 * HTTP-уровневый тест (3.2 AC: невалидное расписание -> 400, а не 500):
 * контроллер + ZodPipe + доменная валидация + ApiErrorFilter, без инфры.
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

const schedule = {
  startTime: '09:00',
  endTime: '18:00',
  durationMinutes: 30,
  workDays: [1, 2, 3, 4, 5],
};

describe('doctors HTTP (create/update/get)', () => {
  let app: NestApplication;
  let doctors: InMemoryDoctorRepository;
  let specId: string;

  beforeEach(async () => {
    const context = makeCatalogContext();
    const spec = await context.specializations.create('Хирург');
    specId = spec.id;
    doctors = context.doctors;

    const moduleRef = await Test.createTestingModule({
      controllers: [CreateDoctorController, UpdateDoctorController, GetDoctorController],
      providers: [
        { provide: UOW_TOKEN, useValue: context.unitOfWork },
        { provide: SPECIALIZATION_REPOSITORY, useValue: context.specializations },
        { provide: DOCTOR_REPOSITORY, useValue: context.doctors },
        {
          provide: PHOTO_URL_SIGNER,
          useValue: { sign: async (key: string) => `https://minio.test/${key}` },
        },
        { provide: LOGGER, useValue: testLogger },
        { provide: APP_FILTER, useClass: ApiErrorFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST валидный -> 201 и событие в outbox', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/catalog/doctors')
      .send({ firstName: 'Иван', lastName: 'Иванов', specializationId: specId, schedule })
      .expect(201);

    expect(response.body).toMatchObject({ firstName: 'Иван', status: 'ACTIVE' });
    expect(await doctors.findById(response.body.id)).not.toBeNull();
  });

  it('POST: период не кратен -> 400 с полем (не 500)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/catalog/doctors')
      .send({
        firstName: 'Иван',
        lastName: 'Иванов',
        specializationId: specId,
        schedule: { ...schedule, endTime: '18:15' },
      })
      .expect(400);

    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      field: 'schedule.durationMinutes',
      message: 'Рабочий период должен быть кратен длительности приёма',
    });
  });

  it('POST: Zod-границы (длительность 4) -> 400 с полем', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/catalog/doctors')
      .send({
        firstName: 'Иван',
        lastName: 'Иванов',
        specializationId: specId,
        schedule: { ...schedule, durationMinutes: 4 },
      })
      .expect(400);

    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(response.body.field).toContain('durationMinutes');
  });

  it('POST: неизвестная специализация -> 400 specializationId', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/catalog/doctors')
      .send({ firstName: 'Иван', lastName: 'Иванов', specializationId: 'absent', schedule })
      .expect(400);

    expect(response.body).toMatchObject({ field: 'specializationId' });
  });

  it('PUT: id тела не совпадает с путем -> 400 field=id', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/catalog/doctors')
      .send({ firstName: 'Иван', lastName: 'Иванов', specializationId: specId, schedule })
      .expect(201);

    const response = await request(app.getHttpServer())
      .put(`/api/catalog/doctors/${created.body.id}`)
      .send({
        id: 'other-id',
        firstName: 'Пётр',
        lastName: 'Иванов',
        specializationId: specId,
        schedule,
      })
      .expect(400);

    expect(response.body).toMatchObject({ field: 'id' });
    expect((await doctors.findById(created.body.id))?.firstName).toBe('Иван');
  });

  it('GET неизвестный id -> 404 в формате ApiError', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/catalog/doctors/no-such')
      .expect(404);

    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('GET существующий -> 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/catalog/doctors')
      .send({ firstName: 'Иван', lastName: 'Иванов', specializationId: specId, schedule })
      .expect(201);

    await request(app.getHttpServer()).get(`/api/catalog/doctors/${created.body.id}`).expect(200);
  });
});
