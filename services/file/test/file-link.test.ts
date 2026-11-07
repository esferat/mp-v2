import { describe, expect, it } from 'vitest';
import { getFileLink } from '../src/features/get-file-link';
import { listFiles } from '../src/features/list-files';
import { makeFileContext } from './helpers/in-memory';

const OWNER = { sub: 'user-1', roles: ['USER'] };
const OTHER = { sub: 'user-2', roles: ['USER'] };
const ADMIN = { sub: 'admin-1', roles: ['ADMIN'] };

const signer = {
  sign: async (bucket: string, key: string) => ({
    url: `http://cdn.test/${bucket}/${key}?sig=1`,
    expiresInSeconds: 300,
  }),
};

async function seedFile(context: ReturnType<typeof makeFileContext>) {
  context.access.patients.set('user-1', 'patient-1');
  return context.files.create({
    key: 'doc-1.pdf',
    bucket: 'patient-docs',
    ownerType: 'PATIENT',
    ownerId: 'patient-1',
    mime: 'application/pdf',
    size: 100,
    uploadedBy: 'user-1',
    category: 'ANALYSIS',
  });
}

describe('getFileLink (4.5: presigned с проверкой владельца)', () => {
  it('владелец получает подписанную ссылку', async () => {
    const context = makeFileContext();
    await seedFile(context);

    const link = await getFileLink(
      { files: context.files, access: context.access, signer },
      'doc-1.pdf',
      OWNER,
    );

    expect(link).toEqual({
      url: 'http://cdn.test/patient-docs/doc-1.pdf?sig=1',
      expiresInSeconds: 300,
    });
  });

  it('ADMIN получает ссылку на любой файл', async () => {
    const context = makeFileContext();
    await seedFile(context);

    const link = await getFileLink(
      { files: context.files, access: context.access, signer },
      'doc-1.pdf',
      ADMIN,
    );
    expect(link.url).toContain('doc-1.pdf');
  });

  it('ЧУЖОЙ пользователь → 403 + лог отказа (AC 4.5), ссылка не выдана', async () => {
    const context = makeFileContext();
    await seedFile(context);
    const warns: unknown[] = [];
    const spy = { warn: (payload: unknown) => warns.push(payload) };

    await expect(
      getFileLink(
        { files: context.files, access: context.access, signer, log: spy },
        'doc-1.pdf',
        OTHER,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(warns).toHaveLength(1);
  });

  it('ключ вне реестра → 404, а не битая ссылка (AC 4.5)', async () => {
    const context = makeFileContext();
    await seedFile(context);

    await expect(
      getFileLink({ files: context.files, access: context.access, signer }, 'absent-key', ADMIN),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('listFiles (4.5/9.3: список владельца)', () => {
  it('владелец видит свои файлы, чужой → 403', async () => {
    const context = makeFileContext();
    await seedFile(context);
    await context.files.create({
      key: 'other.pdf',
      bucket: 'patient-docs',
      ownerType: 'PATIENT',
      ownerId: 'patient-2',
      mime: 'application/pdf',
      size: 5,
      uploadedBy: 'user-2',
    });

    const mine = await listFiles(
      { files: context.files, access: context.access },
      { ownerType: 'PATIENT', ownerId: 'patient-1' },
      OWNER,
    );
    expect(mine.total).toBe(1);
    expect(mine.items[0]?.key).toBe('doc-1.pdf');

    await expect(
      listFiles(
        { files: context.files, access: context.access },
        { ownerType: 'PATIENT', ownerId: 'patient-2' },
        OWNER,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('ADMIN видит файлы любого владельца', async () => {
    const context = makeFileContext();
    await seedFile(context);

    const result = await listFiles(
      { files: context.files, access: context.access },
      { ownerType: 'PATIENT', ownerId: 'patient-1' },
      ADMIN,
    );
    expect(result.total).toBe(1);
  });
});
