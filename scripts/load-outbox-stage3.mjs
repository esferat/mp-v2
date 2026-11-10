// Нагрузочный тест публикации (6.1 AC): 1000 событий/мин через outbox-relay —
// без потерь и без чрезмерного роста лага (алерт при лаге > 30 с, цель p95 < 5 с).
//
// Как работает:
//   1) замеряет базовый счётчик inbox scheduling (db_schedule) — куда доходят события;
//   2) порциями вставляет 1000 записей в OutboxMessage (db_identity) равномерно
//      за ~60 с (≈1000/мин) с routing key patient.updated.v1 — письма не шлётся
//      (нет шаблона у notification), scheduling применяет событие идемпотентно;
//   3) всё время опрашивает /metrics identity: фиксирует max outbox_lag_seconds;
//   4) ждёт полной публикации (PENDING = 0) и сверяет: PUBLISHED + FAILED = 1000,
//      прирост inbox scheduling = 1000 («без потерь» — сверка outbox vs очередь).
//
// Запуск (стенд поднят):
//   node scripts/load-outbox-stage3.mjs           # 1000 событий за минуту
//   node scripts/load-outbox-stage3.mjs 1000 60   # events, seconds
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TOTAL = Number(process.argv[2] ?? 1000);
const SPAN_SECONDS = Number(process.argv[3] ?? 60);
const LAG_ALERT = 30; // алерт OutboxLagHigh в infra/prometheus/alerts.yml

function fail(message) {
  console.error('FAIL:', message);
  process.exit(1);
}

const sqlDir = mkdtempSync(join(tmpdir(), 'mp-load-'));

function psql(database, sql) {
  const file = join(sqlDir, `${randomUUID()}.sql`);
  writeFileSync(file, sql);
  execSync(`docker cp ${JSON.stringify(file)} mp-v2-postgres-1:/tmp/q.sql`);
  return execSync(`docker exec mp-v2-postgres-1 psql -U mp -d ${database} -tA -f /tmp/q.sql`, {
    stdio: 'pipe',
  })
    .toString()
    .trim();
}

async function metric(name) {
  const text = await (await fetch('http://localhost:4001/metrics')).text();
  const line = text.split('\n').find((l) => l.startsWith(`${name} `) && !l.startsWith('#'));
  return line ? Number(line.slice(name.length + 1)) : Number.NaN;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Базовые счётчики ---------------------------------------------------------
const inboxBefore = Number(psql('db_schedule', 'select count(*) from "InboxMessage"'));
console.log(`inbox scheduling до теста: ${inboxBefore}`);

// --- Генерация записей outbox -------------------------------------------------
// Валидный payload patient.updated.v1: scheduling применит его как no-op
// (patientId не найден → 0 обновлений), но сообщение будет доставлено и учтено.
// runId в aggregateId — точный учёт только записей этого прогона.
const runId = Date.now().toString(36);
const rows = [];
for (let i = 0; i < TOTAL; i += 1) {
  const id = randomUUID();
  const payload = JSON.stringify({
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    payload: {
      patientId: `load-${i}`,
      userId: `load-u-${i}`,
      firstName: 'Нагрузка',
      lastName: `Тест${i}`,
      birthDate: '1990-01-01',
      email: `load-${i}@load.test`,
    },
  });
  rows.push(
    `('${id}', 'load-${runId}-${i}', 'patient.updated.v1', '${payload.replace(/'/g, "''")}'::jsonb, now(), 'PENDING', 0, now(), now())`,
  );
}

// --- Замер: вставка порциями + опрос лага -------------------------------------
const portion = Math.max(1, Math.ceil((TOTAL * 1000) / (SPAN_SECONDS * 250))); // порция каждые ~250 мс
let inserted = 0;
let maxLag = 0;
const lagSamples = [];
let overAlert = 0;
const startedAt = Date.now();

const sampler = (async () => {
  while (Date.now() - startedAt < SPAN_SECONDS * 1000 + 5000) {
    const lag = await metric('outbox_lag_seconds');
    if (!Number.isNaN(lag)) {
      lagSamples.push(lag);
      if (lag > maxLag) maxLag = lag;
      if (lag > LAG_ALERT) overAlert += 1;
    }
    await sleep(500);
  }
})();

while (inserted < TOTAL) {
  const batch = rows.slice(inserted, inserted + portion);
  psql(
    'db_identity',
    `insert into "OutboxMessage" (id, "aggregateId", "routingKey", payload, "occurredAt", status, attempts, "nextAttemptAt", "createdAt") values ${batch.join(',')};`,
  );
  inserted += batch.length;
  const elapsed = Date.now() - startedAt;
  const expectedMs = (inserted / TOTAL) * SPAN_SECONDS * 1000;
  if (expectedMs > elapsed) await sleep(expectedMs - elapsed);
}
const insertMs = Date.now() - startedAt;
console.log(`вставлено ${inserted} записей за ${(insertMs / 1000).toFixed(1)} с`);

// --- Ожидание полной публикации ----------------------------------------------
const publishDeadline = Date.now() + 180_000;
for (;;) {
  const pending = Number(
    psql(
      'db_identity',
      `select count(*) from "OutboxMessage" where status = 'PENDING' and "aggregateId" like 'load-${runId}-%'`,
    ),
  );
  if (pending === 0) break;
  if (Date.now() > publishDeadline) fail(`timeout: осталось PENDING = ${pending}`);
  await sleep(1000);
}
await sampler; // дождаться последних замеров лага

// --- Сверка «без потерь» ------------------------------------------------------
const published = Number(
  psql(
    'db_identity',
    `select count(*) from "OutboxMessage" where status = 'PUBLISHED' and "aggregateId" like 'load-${runId}-%'`,
  ),
);
const failed = Number(
  psql(
    'db_identity',
    `select count(*) from "OutboxMessage" where status = 'FAILED' and "aggregateId" like 'load-${runId}-%'`,
  ),
);
const inboxAfter = Number(psql('db_schedule', 'select count(*) from "InboxMessage"'));
const delivered = inboxAfter - inboxBefore;
const totalSeconds = (Date.now() - startedAt) / 1000;

// p95 лага (AC 6.1: «лаг p95 < 5 с под нагрузкой»)
const sorted = [...lagSamples].sort((a, b) => a - b);
const p95 = sorted.length
  ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
  : 0;

console.log('--- Итог ---');
console.log(`опубликовано PUBLISHED: ${published}, FAILED: ${failed}`);
console.log(`доставлено в очередь scheduling (inbox): ${delivered} из ${TOTAL}`);
console.log(
  `лаг: p95 ${p95.toFixed(1)} с, max ${maxLag.toFixed(1)} с (замеров ${lagSamples.length}), превышений алерта >${LAG_ALERT} с: ${overAlert}`,
);
console.log(`общее время: ${totalSeconds.toFixed(1)} с`);

if (failed > 0) fail(`${failed} записей в FAILED — публикация с потерями`);
if (published < TOTAL) fail(`опубликовано только ${published} из ${TOTAL}`);
if (delivered < TOTAL) fail(`дошло до очереди только ${delivered} из ${TOTAL} — потери событий`);
if (overAlert > 0) fail(`лаг превышал алерт-порог ${LAG_ALERT} с (${overAlert} замеров)`);
if (p95 >= 5) fail(`p95 лага ${p95.toFixed(1)} с ≥ 5 с (AC 6.1)`);

console.log('\nAC 6.1 (нагрузка 1000 событий/мин): без потерь, p95 лага < 5 с ✓');
