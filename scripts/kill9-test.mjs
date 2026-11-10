// Внутренний AC-тест 6.1: kill -9 relay → события не теряются.
// 1) убить identity (SIGKILL = docker kill), 2) вставить N PENDING-записей,
// 3) убедиться, что они не публикуются (relay мёртв), 4) поднять identity,
// 5) дождаться полной публикации и доставки в очередь scheduling.
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const N = Number(process.argv[2] ?? 50);
const dir = mkdtempSync(join(tmpdir(), 'mp-kill9-'));

function psql(database, sql) {
  const file = join(dir, `${randomUUID()}.sql`);
  writeFileSync(file, sql);
  execSync(`docker cp ${JSON.stringify(file)} mp-v2-postgres-1:/tmp/q.sql`);
  return execSync(`docker exec mp-v2-postgres-1 psql -U mp -d ${database} -tA -f /tmp/q.sql`, {
    stdio: 'pipe',
  })
    .toString()
    .trim();
}

const sh = (cmd) => execSync(cmd, { stdio: 'pipe' }).toString().trim();
const fail = (m) => {
  console.error('FAIL:', m);
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const inboxBefore = Number(psql('db_schedule', 'select count(*) from "InboxMessage"'));

console.log('1) kill -9 identity (relay)...');
try {
  sh('docker kill mp-v2-identity-1');
} catch {
  console.log('   (контейнер уже остановлен)');
}

console.log(`2) вставляю ${N} PENDING при мёртвом relay...`);
const runId = `kill9-${Date.now().toString(36)}`;
const rows = [];
for (let i = 0; i < N; i += 1) {
  const payload = JSON.stringify({
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    payload: {
      patientId: `${runId}-${i}`,
      userId: 'k',
      firstName: 'Kill',
      lastName: `Nine${i}`,
      birthDate: '1990-01-01',
      email: `k${i}@k.test`,
    },
  });
  rows.push(
    `('${randomUUID()}', '${runId}-${i}', 'patient.updated.v1', '${payload.replace(/'/g, "''")}'::jsonb, now(), 'PENDING', 0, now(), now())`,
  );
}
psql(
  'db_identity',
  `insert into "OutboxMessage" (id, "aggregateId", "routingKey", payload, "occurredAt", status, attempts, "nextAttemptAt", "createdAt") values ${rows.join(',')};`,
);

await sleep(4000);
const pendingDead = Number(
  psql(
    'db_identity',
    `select count(*) from "OutboxMessage" where status = 'PENDING' and "aggregateId" like '${runId}-%'`,
  ),
);
console.log(`3) relay мёртв: PENDING = ${pendingDead} (ждём ${N})`);
if (pendingDead !== N) fail(`ожидалось ${N} PENDING при мёртвом relay, получено ${pendingDead}`);

console.log('4) поднимаю identity...');
sh('docker compose --env-file .env.example -f infra/docker-compose.yml start identity');

const t0 = Date.now();
for (;;) {
  await sleep(2000);
  const published = Number(
    psql(
      'db_identity',
      `select count(*) from "OutboxMessage" where status = 'PUBLISHED' and "aggregateId" like '${runId}-%'`,
    ),
  );
  const failed = Number(
    psql(
      'db_identity',
      `select count(*) from "OutboxMessage" where status = 'FAILED' and "aggregateId" like '${runId}-%'`,
    ),
  );
  const pending = Number(
    psql(
      'db_identity',
      `select count(*) from "OutboxMessage" where status = 'PENDING' and "aggregateId" like '${runId}-%'`,
    ),
  );
  console.log(
    `   ${((Date.now() - t0) / 1000).toFixed(0)}s PUBLISHED=${published} PENDING=${pending} FAILED=${failed}`,
  );
  if (published + failed === N) {
    const inboxAfter = Number(psql('db_schedule', 'select count(*) from "InboxMessage"'));
    const delivered = inboxAfter - inboxBefore;
    console.log(`5) доставлено в очередь scheduling: ${delivered} из ${N}`);
    if (failed > 0) fail(`${failed} записей в FAILED — потеря событий`);
    if (published !== N) fail(`опубликовано ${published} из ${N}`);
    if (delivered < N) fail(`дошло только ${delivered} из ${N} — потеря событий`);
    console.log(`\nAC 6.1 (kill -9 relay): ${N} событий не потеряны ✓`);
    process.exit(0);
  }
  if (Date.now() - t0 > 180_000) fail('timeout: relay не опубликовал записи за 180 с');
}
