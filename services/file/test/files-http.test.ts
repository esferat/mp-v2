import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_FILTER } from '@nestjs/core';
import { Test, type NestApplication } from '@nestjs/testing';
import request from 'supertest';
import { LOGGER, type Logger } from '@mp/service-kit';
import { ApiErrorFilter } from '../src/app/kernel';
import { ACCESS_PORTS } from '../src/entities/access';
import { OBJECT_STORE, PHOTO_LINKER } from '../src/entities/file';
import { UNIT_OF_WORK } from '../src/entities/repository';
import { DeleteFileController } from '../src/features/delete-file/api/delete-file.controller';
import { UploadFileController } from '../src/features/upload-file/api/upload-file.controller';
import { makeFileContext } from './helpers/in-memory';

/**
 * HTTP-тест multipart-загрузки (4.4 AC): лимит и тип отвечают 400,
 * а не 500; объект при отказе не остаётся (проверяется по стору).
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

function pdfBuffer(size = 32): Buffer {
  const buffer = Buffer.alloc(size);
  buffer.write('%PDF-1.7', 0, 'ascii');
  return buffer;
}

describe('files HTTP (upload/delete)', () => {
  let app: NestApplication;
  let context: ReturnType<typeof makeFileContext>;

  beforeEach(async () => {
    context = makeFileContext();

    const moduleRef = await Test.createTestingModule({
      controllers: [UploadFileController, DeleteFileController],
      providers: [
        { provide: UNIT_OF_WORK, useValue: context.unitOfWork },
        { provide: OBJECT_STORE, useValue: context.store },
        { provide: ACCESS_PORTS, useValue: context.access },
        { provide: PHOTO_LINKER, useValue: context.photos },
        { provide: LOGGER, useValue: testLogger },
        { provide: APP_FILTER, useClass: ApiErrorFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Фейковый guard: claims кладёт JwtAuthGuard, здесь имитируем ADMIN
    app.use((request_: { auth?: unknown }, _response: unknown, next: () => void) => {
      request_.auth = { sub: 'admin-1', realmRoles: ['ADMIN'] };
      next();
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const fields = (builder: request.Test): request.Test =>
    builder.field('ownerType', 'PATIENT').field('ownerId', 'patient-1').field('kind', 'DOCUMENT');

  it('валидный PDF -> 201, объект и строка появились', async () => {
    const response = await fields(request(app.getHttpServer()).post('/api/files/upload'))
      .attach('file', pdfBuffer(), { filename: 'scan.pdf', contentType: 'application/pdf' })
      .expect(201);

    expect(response.body).toMatchObject({ bucket: 'patient-docs', mime: 'application/pdf' });
    expect(context.store.has('patient-docs', response.body.key)).toBe(true);
    expect(context.files.rows.size).toBe(1);
  });

  it('файл больше 5 МБ -> 400 FILE_TOO_LARGE, объект не создан', async () => {
    const big = pdfBuffer(5 * 1024 * 1024 + 1);
    const response = await fields(request(app.getHttpServer()).post('/api/files/upload'))
      .attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' })
      .expect(400);

    expect(response.body).toMatchObject({ code: 'FILE_TOO_LARGE' });
    expect(context.store.objects.size).toBe(0);
    expect(context.files.rows.size).toBe(0);
  });

  it('содержимое не похоже на допустимый формат -> 400 с полем file', async () => {
    const junk = Buffer.alloc(64, 7);
    const response = await fields(request(app.getHttpServer()).post('/api/files/upload'))
      .attach('file', junk, { filename: 'junk.pdf', contentType: 'application/pdf' })
      .expect(400);

    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR', field: 'file' });
    expect(context.store.objects.size).toBe(0);
  });

  it('без файла (только поля) -> 400', async () => {
    const response = await fields(request(app.getHttpServer()).post('/api/files/upload')).expect(
      400,
    );
    expect(response.body.field).toBe('file');
  });

  it('DELETE /api/files/:key владельцу -> 200, объект и строка удалены', async () => {
    const created = await fields(request(app.getHttpServer()).post('/api/files/upload'))
      .attach('file', pdfBuffer(), { filename: 'scan.pdf', contentType: 'application/pdf' })
      .expect(201);

    await request(app.getHttpServer()).delete(`/api/files/${created.body.key}`).expect(200);

    expect(context.files.rows.size).toBe(0);
    expect(context.store.objects.size).toBe(0);
    expect(context.outbox.events.map((event) => event.routingKey)).toEqual([
      'document.uploaded.v1',
      'document.deleted.v1',
    ]);
  });

  it('DELETE неизвестного ключа -> 404 в формате ApiError', async () => {
    const response = await request(app.getHttpServer()).delete('/api/files/absent-key').expect(404);
    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
  });
});
