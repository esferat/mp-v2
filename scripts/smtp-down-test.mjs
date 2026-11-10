// Внутренний AC-тест 6.2: падение SMTP → сообщения копятся и доставляются
// после восстановления, без потерь.
// 1) остановить mailpit, 2) опубликовать событие user.registered.v1,
// 3) убедиться, что письма НЕТ и сообщение копится в очереди (requeue),
// 4) поднять mailpit, 5) дождаться письма.
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';

const MGMT = 'http://localhost:15672';
const MAILPIT = 'http://localhost:8025';
const QUEUE = 'q.notification.user-registered';
const EXCHANGE = 'medical.events';
const rabbitAuth =
  'Basic ' +
  Buffer.from(
    `${process.env.RABBITMQ_USER ?? 'guest'}:${process.env.RABBITMQ_PASSWORD ?? 'guest'}`,
  ).toString('base64');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => {
  console.error('FAIL:', m);
  process.exit(1);
};
const sh = (cmd) => execSync(cmd, { stdio: 'pipe' }).toString().trim();

async function mailCount(address) {
  // Mailpit остановлен (шаг 3) — API недоступен, трактуем как «писем нет».
  try {
    const list = await (await fetch(`${MAILPIT}/api/v1/messages?limit=100`)).json();
    return (list.messages ?? []).filter((m) => (m.To ?? []).some((t) => t.Address === address))
      .length;
  } catch {
    return 0;
  }
}

async function queueDepth(name) {
  const r = await fetch(`${MGMT}/api/queues/%2F/${encodeURIComponent(name)}`, {
    headers: { authorization: rabbitAuth },
  });
  if (!r.ok) return -1;
  return (await r.json()).messages;
}

const email = `smtp-down-${Date.now()}@test.mp`;

console.log('1) останавливаю mailpit (SMTP недоступен)...');
sh('docker compose --env-file .env.example -f infra/docker-compose.yml stop mailpit');
await sleep(2000);

console.log('2) публикую событие user.registered.v1...');
const envelope = {
  eventId: randomUUID(),
  occurredAt: new Date().toISOString(),
  payload: { userId: `u-${Date.now()}`, email, locale: 'ru' },
};
const publish = await fetch(`${MGMT}/api/exchanges/%2F/${EXCHANGE}/publish`, {
  method: 'POST',
  headers: { authorization: rabbitAuth, 'content-type': 'application/json' },
  body: JSON.stringify({
    routing_key: 'user.registered.v1',
    payload: JSON.stringify(envelope),
    payload_encoding: 'string',
    properties: { content_type: 'application/json' },
  }),
});
if (!publish.ok) fail(`publish → ${publish.status}`);

console.log('3) жду 20 с: письма нет, сообщение копится (requeue)...');
await sleep(20_000);
const lettersDown = await mailCount(email);
const depthDown = await queueDepth(QUEUE);
console.log(`   писем: ${lettersDown} (ждём 0), глубина очереди: ${depthDown} (ждём > 0)`);
if (lettersDown !== 0) fail('письмо ушло при недоступном SMTP — не проверено копление');
if (depthDown < 1) fail('сообщение не копится в очереди при падении SMTP');

console.log('4) поднимаю mailpit...');
sh('docker compose --env-file .env.example -f infra/docker-compose.yml start mailpit');

const t0 = Date.now();
for (;;) {
  await sleep(2000);
  const letters = await mailCount(email);
  if (letters >= 1) {
    console.log(
      `5) письмо доставлено после восстановления SMTP за ${((Date.now() - t0) / 1000).toFixed(0)} с`,
    );
    console.log('\nAC 6.2 (падение SMTP): сообщение копилось и доставлено без потерь ✓');
    process.exit(0);
  }
  if (Date.now() - t0 > 120_000)
    fail('timeout: письмо не пришло за 120 с после восстановления SMTP');
}
