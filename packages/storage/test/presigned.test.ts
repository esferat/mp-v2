import { describe, expect, it } from 'vitest';
import { S3Client } from '@aws-sdk/client-s3';
import { BUCKETS, loadStorageEnv, storageEnvSchema } from '../src/config';
import { presignGet, presignPostForm, presignPut } from '../src/s3/presigned';

function makeClient(): S3Client {
  return new S3Client({
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    credentials: { accessKeyId: 'minio', secretAccessKey: 'minio123' },
    forcePathStyle: true,
  });
}

describe('storageEnvSchema', () => {
  it('дефолты соответствуют dev-окружению', () => {
    const env = storageEnvSchema.parse({});
    expect(env).toMatchObject({
      MINIO_ENDPOINT: 'http://localhost:9000',
      PRESIGNED_TTL_SECONDS: 300, // 5 минут — NFR портала
    });
  });

  it('loadStorageEnv читает из process.env и приводит TTL к числу', () => {
    const env = loadStorageEnv({ PRESIGNED_TTL_SECONDS: '60' } as NodeJS.ProcessEnv);
    expect(env.PRESIGNED_TTL_SECONDS).toBe(60);
  });

  it('некорректный TTL → понятная ошибка', () => {
    expect(() => loadStorageEnv({ PRESIGNED_TTL_SECONDS: '0' } as NodeJS.ProcessEnv)).toThrow(
      /PRESIGNED_TTL_SECONDS/,
    );
  });

  it('бакеты портала совпадают с infra/minio-init', () => {
    expect(BUCKETS).toEqual({
      patientPhotos: 'patient-photos',
      doctorPhotos: 'doctor-photos',
      patientDocs: 'patient-docs',
      tmp: 'tmp',
    });
  });
});

describe('presigned GET (0.5)', () => {
  it('ссылка подписана, содержит bucket/key и TTL 300с', async () => {
    const url = await presignGet(makeClient(), {
      bucket: BUCKETS.patientDocs,
      key: 'p1/scan.pdf',
    });

    expect(url).toContain('http://localhost:9000/patient-docs/p1/scan.pdf');
    expect(url).toContain('X-Amz-Expires=300');
    expect(url).toContain('X-Amz-Signature=');
    expect(url).toContain('X-Amz-SignedHeaders=host');
  });

  it('TTL переопределяется (истечение контролируется вызывающим)', async () => {
    const url = await presignGet(makeClient(), {
      bucket: BUCKETS.tmp,
      key: 'a.jpg',
      expiresInSeconds: 60,
    });
    expect(url).toContain('X-Amz-Expires=60');
  });

  it('пустой bucket/key — ошибка, а не подписанная ерунда', async () => {
    await expect(presignGet(makeClient(), { bucket: '', key: 'x' })).rejects.toThrow(/bucket/);
    await expect(presignGet(makeClient(), { bucket: 'b', key: '' })).rejects.toThrow(/key/);
  });
});

describe('presigned PUT (0.5)', () => {
  it('PUT-ссылка подписана с TTL', async () => {
    const url = await presignPut(makeClient(), {
      bucket: BUCKETS.patientDocs,
      key: 'p1/scan.pdf',
      contentType: 'application/pdf',
    });
    expect(url).toContain('X-Amz-Expires=300');
    expect(url).toContain('X-Amz-Signature=');
    // NB: aws-sdk v3 не включает content-type в подпись PUT — ограничение
    // типа/размера для загрузки даёт presignPostForm (политика бакета, ниже)
  });
});

describe('presigned POST-policy (0.5: тип и размер ограничены policy)', () => {
  it('политика ограничивает размер (content-length-range) и тип (eq $Content-Type)', async () => {
    const { url, fields } = await presignPostForm(makeClient(), {
      bucket: BUCKETS.patientDocs,
      key: 'p1/scan.pdf',
      contentType: 'application/pdf',
      maxBytes: 5 * 1024 * 1024,
      expiresInSeconds: 300,
    });

    expect(url).toBe('http://localhost:9000/patient-docs');
    expect(fields.key).toBe('p1/scan.pdf');
    expect(fields.Policy).toBeTruthy();

    const policy = JSON.parse(Buffer.from(fields.Policy, 'base64').toString('utf8'));
    expect(policy.expiration).toBeTruthy();
    expect(policy.conditions).toContainEqual(['eq', '$Content-Type', 'application/pdf']);
    expect(policy.conditions).toContainEqual(['content-length-range', 1, 5 * 1024 * 1024]);
  });

  it('неверные входные данные → ошибка до выдачи ссылки', async () => {
    await expect(
      presignPostForm(makeClient(), {
        bucket: BUCKETS.tmp,
        key: 'a.jpg',
        contentType: 'image/jpeg',
        maxBytes: 0,
      }),
    ).rejects.toThrow(/maxBytes/);

    await expect(
      presignPostForm(makeClient(), {
        bucket: BUCKETS.tmp,
        key: 'a.jpg',
        contentType: '',
        maxBytes: 100,
      }),
    ).rejects.toThrow(/contentType/);
  });
});
