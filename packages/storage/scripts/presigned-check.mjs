#!/usr/bin/env node
/**
 * Интеграционная проверка AC задачи 0.5 против ЖИВОГО MinIO:
 *
 *   1. залить объект через presigned PUT;
 *   2. скачать по presigned GET (200, тело совпадает);
 *   3. прямой доступ без подписи → отказ (403);
 *   4. после истечения TTL ссылка перестаёт работать (403).
 *
 * Запуск (стек поднят: docker compose up -d minio minio-init):
 *   node scripts/e2e/presigned-check.mjs
 * TTL задаётся коротким (10 с), чтобы проверка уложилась в ~12 секунд.
 */
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const endpoint = process.env.MINIO_ENDPOINT ?? 'http://localhost:9000';
const accessKey = process.env.MINIO_ROOT_USER ?? 'minio';
const secretKey = process.env.MINIO_ROOT_PASSWORD ?? 'minio123';
const bucket = 'tmp';
const key = `e2e/presigned-${Date.now()}.txt`;
const ttlSeconds = 10;
const payload = 'presigned-check payload';

const client = new S3Client({
  endpoint,
  region: 'us-east-1',
  credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  forcePathStyle: true,
});

const fail = (message) => {
  console.error(`[presigned-check] FAIL: ${message}`);
  process.exit(1);
};
const ok = (message) => console.log(`[presigned-check] ok: ${message}`);

// 1. presigned PUT → загрузка
const putUrl = await getSignedUrl(
  client,
  new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: 'text/plain' }),
  { expiresIn: ttlSeconds },
);
const putResponse = await fetch(putUrl, {
  method: 'PUT',
  headers: { 'content-type': 'text/plain' },
  body: payload,
});
if (putResponse.status !== 200) fail(`PUT ${putResponse.status} (ожидали 200)`);
ok('объект залит через presigned PUT');

// 2. presigned GET → скачивание
const getUrl = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
  expiresIn: ttlSeconds,
});
const getResponse = await fetch(getUrl);
if (getResponse.status !== 200) fail(`GET ${getResponse.status} (ожидали 200)`);
const body = await getResponse.text();
if (body !== payload) fail(`тело не совпало: ${JSON.stringify(body)}`);
ok('presigned GET отдал правильное тело');

// 3. прямой доступ без подписи → отказ
const direct = await fetch(`${endpoint}/${bucket}/${key}`);
if (direct.status === 200) fail('объект доступен без подписи — бакет не private');
ok(`без подписи отказ (${direct.status}) — объект не публичен`);

// 4. истечение TTL
console.log(`[presigned-check] ждём ${ttlSeconds + 1}с истечения подписи…`);
await new Promise((resolve) => setTimeout(resolve, (ttlSeconds + 1) * 1000));
const expired = await fetch(getUrl);
if (expired.status === 200) fail('истёкшая ссылка всё ещё работает');
ok(`истёкшая ссылка отклонена (${expired.status})`);

console.log('[presigned-check] ВСЕ ПРОВЕРКИ 0.5 ПРОЙДЕНЫ');
