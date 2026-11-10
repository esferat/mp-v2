// Внутренний бенч: сколько relay публикует записей в секунду (диагностика лага 6.1).
// Вставляет N PENDING-записей разом и меряет время их полной публикации.
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const N = Number(process.argv[2] ?? 500);
const dir = mkdtempSync(join(tmpdir(), 'mp-bench-'));

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

const runId = `bench-${Date.now().toString(36)}`;
const rows = [];
for (let i = 0; i < N; i += 1) {
  const payload = JSON.stringify({
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    payload: {
      patientId: `${runId}-${i}`,
      userId: 'bu',
      firstName: 'N',
      lastName: 'T',
      birthDate: '1990-01-01',
      email: 'b@b.test',
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
console.log(`inserted ${N} PENDING at ${runId}`);

const t0 = Date.now();
let pending = N;
while (pending > 0 && Date.now() - t0 < 120_000) {
  await new Promise((r) => setTimeout(r, 1000));
  pending = Number(
    psql(
      'db_identity',
      `select count(*) from "OutboxMessage" where status = 'PENDING' and "aggregateId" like '${runId}-%'`,
    ),
  );
  const metrics = await (await fetch('http://localhost:4001/metrics')).text();
  const lag = metrics
    .split('\n')
    .find((l) => l.startsWith('outbox_lag_seconds ') && !l.startsWith('#'));
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s pending=${pending} ${lag}`);
}
const elapsed = (Date.now() - t0) / 1000;
console.log(
  pending === 0
    ? `OK: ${N} за ${elapsed.toFixed(1)} с → ${(N / elapsed).toFixed(0)} событий/с`
    : `FAIL: осталось PENDING=${pending}`,
);
process.exit(pending === 0 ? 0 : 1);
