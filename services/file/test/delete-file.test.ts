import { describe, expect, it } from 'vitest';
import { RoutingKeys } from '@mp/contracts';
import { deleteFile, type DeleteFileDeps } from '../src/features/delete-file';
import { makeFileContext } from './helpers/in-memory';

const ADMIN = { sub: 'admin-1', roles: ['ADMIN'] };
const OWNER = { sub: 'user-1', roles: ['USER'] };
const OTHER = { sub: 'user-2', roles: ['USER'] };

async function seedDocument(): Promise<{
  context: ReturnType<typeof makeFileContext>;
  deps: DeleteFileDeps;
  key: string;
}> {
  const context = makeFileContext();
  context.access.patients.set('user-1', 'patient-1');
  const row = await context.files.create({
    key: 'doc.pdf',
    bucket: 'patient-docs',
    ownerType: 'PATIENT',
    ownerId: 'patient-1',
    mime: 'application/pdf',
    size: 10,
    uploadedBy: 'user-1',
  });
  context.store.objects.set('patient-docs/doc.pdf', new Uint8Array(4));
  return {
    context,
    deps: { unitOfWork: context.unitOfWork, store: context.store, access: context.access },
    key: row.key,
  };
}

describe('deleteFile (use-case, 4.4)', () => {
  it('владелец удаляет: строка, объект и событие document.deleted.v1', async () => {
    const { context, deps, key } = await seedDocument();

    await deleteFile(deps, key, OWNER);

    expect(await context.files.findByKey(key)).toBeNull();
    expect(context.store.has('patient-docs', key)).toBe(false);
    expect(context.outbox.events).toHaveLength(1);
    expect(context.outbox.events[0]?.routingKey).toBe(RoutingKeys.DocumentDeleted);
    expect(context.outbox.events[0]?.payload).toMatchObject({
      payload: { key, ownerType: 'PATIENT', ownerId: 'patient-1' },
    });
  });

  it('чужой пользователь -> 403, файл остался', async () => {
    const { context, deps, key } = await seedDocument();

    await expect(deleteFile(deps, key, OTHER)).rejects.toMatchObject({ status: 403 });

    expect(await context.files.findByKey(key)).not.toBeNull();
    expect(context.store.has('patient-docs', key)).toBe(true);
    expect(context.outbox.events).toHaveLength(0);
  });

  it('неизвестный ключ -> 404 (и это не битый файл)', async () => {
    const { deps } = await seedDocument();

    await expect(deleteFile(deps, 'no-such-key', ADMIN)).rejects.toMatchObject({ status: 404 });
  });

  it('повторное удаление -> 404 без побочных эффектов', async () => {
    const { deps, key } = await seedDocument();
    await deleteFile(deps, key, ADMIN);

    await expect(deleteFile(deps, key, ADMIN)).rejects.toMatchObject({ status: 404 });
  });

  it('падение очистки объекта не ломает удаление (стратегия: реестр первый)', async () => {
    const { context, deps, key } = await seedDocument();
    context.store.failNextRemove = new Error('minio down');

    await deleteFile(deps, key, OWNER);

    expect(await context.files.findByKey(key)).toBeNull();
    expect(context.outbox.events).toHaveLength(1);
    // Объект остался (сирота) и будет виден только по ключу
    expect(context.store.has('patient-docs', key)).toBe(true);
  });
});
