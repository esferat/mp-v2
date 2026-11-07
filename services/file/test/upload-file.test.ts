import { describe, expect, it } from 'vitest';
import { RoutingKeys } from '@mp/contracts';
import { uploadFile, type UploadFileDeps } from '../src/features/upload-file';
import { makeFileContext } from './helpers/in-memory';

type Context = ReturnType<typeof makeFileContext>;

function pdfBytes(size = 16): Uint8Array {
  const buffer = new Uint8Array(size);
  buffer.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0);
  return buffer;
}

function jpegBytes(size = 16): Uint8Array {
  const buffer = new Uint8Array(size);
  buffer.set([0xff, 0xd8, 0xff, 0xe0], 0);
  return buffer;
}

function depsOf(context: Context): UploadFileDeps {
  return {
    unitOfWork: context.unitOfWork,
    store: context.store,
    access: context.access,
    photos: context.photos,
  };
}

describe('uploadFile (use-case, 4.4)', () => {
  it('успешная загрузка документа: объект, реестр, событие document.uploaded.v1', async () => {
    const context = makeFileContext();
    context.access.patients.set('user-1', 'patient-1');

    const result = await uploadFile(depsOf(context), {
      fields: {
        ownerType: 'PATIENT',
        ownerId: 'patient-1',
        kind: 'DOCUMENT',
        category: 'ANALYSIS',
      },
      file: { buffer: pdfBytes() },
      subject: { sub: 'user-1', roles: ['USER'] },
    });

    expect(result).toMatchObject({ bucket: 'patient-docs', mime: 'application/pdf' });
    expect(context.store.has('patient-docs', result.key)).toBe(true);

    const row = await context.files.findByKey(result.key);
    expect(row).toMatchObject({
      ownerType: 'PATIENT',
      ownerId: 'patient-1',
      uploadedBy: 'user-1',
      category: 'ANALYSIS',
    });

    expect(context.outbox.events).toHaveLength(1);
    expect(context.outbox.events[0]?.routingKey).toBe(RoutingKeys.DocumentUploaded);
    expect(context.outbox.events[0]?.payload).toMatchObject({
      eventId: expect.any(String),
      payload: {
        key: result.key,
        bucket: 'patient-docs',
        uploadedBy: 'user-1',
        category: 'ANALYSIS',
      },
    });
  });

  it('чужой пользователь -> 403, ничего не записано', async () => {
    const context = makeFileContext();
    context.access.patients.set('user-1', 'patient-1');

    await expect(
      uploadFile(depsOf(context), {
        fields: { ownerType: 'PATIENT', ownerId: 'patient-1', kind: 'DOCUMENT' },
        file: { buffer: pdfBytes() },
        subject: { sub: 'user-2', roles: ['USER'] },
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(context.store.objects.size).toBe(0);
    expect(context.files.rows.size).toBe(0);
  });

  it('неизвестный формат -> 400 field=file, объект не создан', async () => {
    const context = makeFileContext();
    context.access.patients.set('user-1', 'patient-1');

    await expect(
      uploadFile(depsOf(context), {
        fields: { ownerType: 'PATIENT', ownerId: 'patient-1', kind: 'DOCUMENT' },
        file: { buffer: Uint8Array.from([1, 2, 3, 4, 5, 6]) },
        subject: { sub: 'user-1', roles: ['USER'] },
      }),
    ).rejects.toMatchObject({ status: 400, field: 'file' });

    expect(context.store.objects.size).toBe(0);
  });

  it('WebP в DOCUMENT (не подходит) -> 400 field=file', async () => {
    const context = makeFileContext();
    context.access.patients.set('user-1', 'patient-1');
    const webp = new Uint8Array(16);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);

    await expect(
      uploadFile(depsOf(context), {
        fields: { ownerType: 'PATIENT', ownerId: 'patient-1', kind: 'DOCUMENT' },
        file: { buffer: webp },
        subject: { sub: 'user-1', roles: ['USER'] },
      }),
    ).rejects.toMatchObject({ status: 400, field: 'file' });
  });

  it('DOCUMENT для DOCTOR-owner -> 400 (только пациент)', async () => {
    const context = makeFileContext();

    await expect(
      uploadFile(depsOf(context), {
        fields: { ownerType: 'DOCTOR', ownerId: 'doctor-1', kind: 'DOCUMENT' },
        file: { buffer: pdfBytes() },
        subject: { sub: 'admin-1', roles: ['ADMIN'] },
      }),
    ).rejects.toMatchObject({ status: 400, field: 'ownerType' });
  });

  it('фото: привязка к карточке, старое фото удаляется (3.4/4.3)', async () => {
    const context = makeFileContext();
    context.access.patients.set('user-1', 'patient-1');
    context.photos.photos.set('PATIENT:patient-1', 'old-photo.jpg');
    context.store.objects.set('patient-photos/old-photo.jpg', jpegBytes());

    const result = await uploadFile(depsOf(context), {
      fields: { ownerType: 'PATIENT', ownerId: 'patient-1', kind: 'PHOTO' },
      file: { buffer: jpegBytes() },
      subject: { sub: 'admin-1', roles: ['ADMIN'] },
    });

    expect(context.photos.photos.get('PATIENT:patient-1')).toBe(result.key);
    // Старый объект и его строка убраны (строки раньше не было, только объект)
    expect(context.store.has('patient-photos', 'old-photo.jpg')).toBe(false);
    expect(context.outbox.events).toHaveLength(1);
  });

  it('сбой привязки фото: новый объект убран, ошибка 502', async () => {
    const context = makeFileContext();
    context.photos.failNextLink = new Error('catalog down');

    await expect(
      uploadFile(depsOf(context), {
        fields: { ownerType: 'DOCTOR', ownerId: 'doctor-1', kind: 'PHOTO' },
        file: { buffer: jpegBytes() },
        subject: { sub: 'admin-1', roles: ['ADMIN'] },
      }),
    ).rejects.toMatchObject({ status: 502 });

    expect(context.store.objects.size).toBe(0);
    expect(context.files.rows.size).toBe(0);
    expect(context.outbox.events).toHaveLength(0);
  });

  it('сбой транзакции: объект убран, фото возвращено на прежний ключ', async () => {
    const context = makeFileContext();
    context.photos.photos.set('DOCTOR:doctor-1', 'prev.jpg');
    context.unitOfWork.failNextRun = new Error('db down');

    await expect(
      uploadFile(depsOf(context), {
        fields: { ownerType: 'DOCTOR', ownerId: 'doctor-1', kind: 'PHOTO' },
        file: { buffer: jpegBytes() },
        subject: { sub: 'admin-1', roles: ['ADMIN'] },
      }),
    ).rejects.toThrow('db down');

    expect(context.store.objects.size).toBe(0);
    expect(context.photos.photos.get('DOCTOR:doctor-1')).toBe('prev.jpg');
  });

  it('повторная загрузка (дубль) даёт второй независимый ключ', async () => {
    const context = makeFileContext();
    context.access.patients.set('user-1', 'patient-1');
    const command = {
      fields: { ownerType: 'PATIENT', ownerId: 'patient-1', kind: 'DOCUMENT' },
      file: { buffer: pdfBytes() },
      subject: { sub: 'user-1', roles: ['USER'] },
    };

    const first = await uploadFile(depsOf(context), command);
    const second = await uploadFile(depsOf(context), command);

    expect(first.key).not.toBe(second.key);
    expect(context.files.rows.size).toBe(2);
  });
});
