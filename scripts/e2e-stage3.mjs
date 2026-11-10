// E2E Этап 3 (6.2/6.3): письма по событиям, идемпотентность по eventId,
// отравленное сообщение → DLQ, replay из DLQ → обработано.
//
// Запуск (стенд поднят: gateway, identity, scheduling, notification, mailpit):
//   node scripts/e2e-stage3.mjs
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const GATEWAY = 'http://localhost:4000';
const MAILPIT = 'http://localhost:8025';
const MGMT = 'http://localhost:15672';
const HEALTHZ = 'http://localhost:4007/healthz';
const EXCHANGE = 'medical.events';
const DLX = 'medical.dlx';
const QUEUE = 'q.notification.user-registered';
const DLQ = `${QUEUE}.dlq`;

const rabbitAuth =
  'Basic ' +
  Buffer.from(
    `${process.env.RABBITMQ_USER ?? 'guest'}:${process.env.RABBITMQ_PASSWORD ?? 'guest'}`,
  ).toString('base64');

/** SQL в БД стенда (docker exec psql) — для сверки пациента в шаге 6. */
const sqlDir = mkdtempSync(join(tmpdir(), 'mp-e2e3-'));

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

function fail(message) {
  console.error('FAIL:', message);
  process.exit(1);
}

function ok(message) {
  console.log('OK:', message);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function req(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(url.startsWith(MGMT) ? { authorization: rabbitAuth } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    fail(`${init.method ?? 'GET'} ${url} → ${response.status}: ${await response.text()}`);
  }
  return response;
}

/** Публикация события напрямую в exchange/DLX (management API). */
async function publish(routingKey, envelope, { toDlq = false } = {}) {
  const exchange = toDlq ? DLX : EXCHANGE;
  await req(`${MGMT}/api/exchanges/%2F/${exchange}/publish`, {
    method: 'POST',
    body: JSON.stringify({
      routing_key: routingKey,
      payload: JSON.stringify(envelope),
      payload_encoding: 'string',
      properties: { content_type: 'application/json' },
    }),
  });
}

async function queueDepth(name) {
  const response = await fetch(`${MGMT}/api/queues/%2F/${encodeURIComponent(name)}`, {
    headers: { authorization: rabbitAuth },
  });
  if (!response.ok) return -1;
  return (await response.json()).messages;
}

/** Письма на адрес (после очистки mailpit — все письма принадлежат тесту). */
async function mailTo(address) {
  const response = await fetch(`${MAILPIT}/api/v1/messages?limit=100`);
  const data = await response.json();
  return data.messages.filter((m) => (m.To ?? []).some((to) => to.Address === address));
}

/** Пустой массив — ещё не найдено (массив truthy в JS: проверяем длину). */
function ready(value) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

async function waitFor(check, label, timeoutMs = 45_000) {
  const startedAt = Date.now();
  for (;;) {
    const value = await check();
    if (ready(value)) return value;
    if (Date.now() - startedAt > timeoutMs) fail(`таймаут ожидания: ${label}`);
    await sleep(400);
  }
}

function event(payload, eventId) {
  return { eventId, occurredAt: new Date().toISOString(), payload };
}

// --- Шаг 0: чистое состояние -------------------------------------------------
await req(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });
ok('mailpit очищен');
// Очистка очередей от прошлых прогонов: отравленное сообщение из шага 4
// иначе попадёт в replay следующего прогона и будет качаться в цикле
// (падает → DLQ → replay → падает …). Purge — через CLI (management API
// в этом образе не отдаёт purge-эндпоинт).
for (const queue of [QUEUE, DLQ]) {
  execSync(`docker exec mp-v2-rabbitmq-1 rabbitmqctl purge_queue ${queue}`, { stdio: 'pipe' });
}
ok('очереди user-registered/dlq очищены');

// --- Шаг 1: регистрация → письмо «приветствие» (6.2) --------------------------
const email = `e2e-stage3-${Date.now()}@test.mp`;
await req(`${GATEWAY}/api/identity/register`, {
  method: 'POST',
  body: JSON.stringify({
    email,
    password: 'Password123!',
    firstName: 'Пациент',
    lastName: 'Этап3',
    birthDate: '1992-03-03',
  }),
});
const greeting = await waitFor(() => mailTo(email), `письмо приветствия для ${email}`);
if (greeting.length !== 1) fail(`ожидалось 1 письмо, получено ${greeting.length}`);
if (!greeting[0].Subject.includes('Добро пожаловать')) {
  fail(`неожиданная тема: ${greeting[0].Subject}`);
}
ok(`письмо «${greeting[0].Subject}» → ${email}`);

// --- Шаг 2: повтор события → письмо одно (6.3: inbox по eventId) --------------
// Публикуем один и тот же конверт дважды (at-least-once): вторая доставка
// гасится inbox по eventId — письмо не дублируется.
const dupEmail = `e2e-dup-${Date.now()}@test.mp`;
const duplicated = event(
  { userId: `e2e-d-${Date.now()}`, email: dupEmail, locale: 'ru' },
  crypto.randomUUID(),
);
await publish('user.registered.v1', duplicated);
await waitFor(() => mailTo(dupEmail), `первое письмо для ${dupEmail}`);
await publish('user.registered.v1', duplicated);
await sleep(3000);
const afterDuplicate = await mailTo(dupEmail);
if (afterDuplicate.length !== 1) {
  fail(`дубль события создал писем: ${afterDuplicate.length} (ждём 1 — inbox)`);
}
ok('повтор того же eventId → письмо одно (идемпотентность)');

// --- Шаг 3: replay из DLQ (6.3 AC) -------------------------------------------
// Валидное событие, попавшее напрямую в DLX: routing key DLX-биндинга DLQ —
// это имя очереди (x-dead-letter-routing-key = queue, см. rabbit.service).
const replayEmail = `e2e-replay-${Date.now()}@test.mp`;
await publish(
  QUEUE,
  event({ userId: `e2e-r-${Date.now()}`, email: replayEmail, locale: 'ru' }, crypto.randomUUID()),
  { toDlq: true },
);
await waitFor(async () => (await queueDepth(DLQ)) > 0, `сообщение в DLQ (${DLQ})`);
ok(`сообщение попало в ${DLQ}`);

execSync(`node scripts/replay-dlq.mjs ${QUEUE}`, { stdio: 'inherit' });
await waitFor(async () => (await queueDepth(DLQ)) === 0, 'DLQ опустел после replay');
const replayed = await waitFor(() => mailTo(replayEmail), `письмо после replay → ${replayEmail}`);
if (replayed.length !== 1) fail(`после replay писем: ${replayed.length} (ждём 1)`);
ok('replay: сообщение из DLQ обработано, письмо отправлено');

// --- Шаг 4: отравленное сообщение → DLQ, сервис жив (6.3 AC) ------------------
await publish(
  'user.registered.v1',
  { eventId: 'poison-1', occurredAt: 'not-a-date', payload: {} }, // нарушение схемы
);
await waitFor(async () => (await queueDepth(DLQ)) > 0, 'отравленное сообщение в DLQ');
const health = await fetch(HEALTHZ);
if (!health.ok) fail(`сервис упал после отравленного сообщения: ${health.status}`);
ok('нарушение схемы → DLQ, notification жив (/healthz 200)');

// --- Шаг 5: события без шаблона писем не шлют (6.2 AC) ------------------------
const before = (await (await fetch(`${MAILPIT}/api/v1/messages?limit=100`)).json()).total;
await publish(
  'patient.updated.v1',
  event(
    {
      patientId: 'e2e-no-letter',
      userId: `e2e-p-${Date.now()}`,
      firstName: 'Без',
      lastName: 'Письма',
      birthDate: '1990-01-01',
      email: 'no-letter@test.mp',
    },
    crypto.randomUUID(),
  ),
);
await sleep(3000);
const after = (await (await fetch(`${MAILPIT}/api/v1/messages?limit=100`)).json()).total;
if (after !== before) fail(`событие без шаблона добавило писем: ${before} → ${after}`);
ok('patient.updated (нет шаблона) → писем не добавилось');

// --- Шаг 6: каждое событие списка шаблонов → ровно одно письмо (6.2 AC) ------
// Адресат — пациент, зарегистрированный в шаге 1 (его приветствие уже есть,
// ждём прирост ровно на 7 писем с темами из спеки).
const card = psql(
  'db_patients',
  `select id || '|' || "userId" from "Patient" where email = '${email}'`,
);
if (!card || !card.includes('|')) fail(`карточка пациента ${email} не найдена в db_patients`);
const [patientId, patientUserId] = card.split('|');

const core = {
  appointmentId: 'e2e-ap-1',
  patientId,
  patientName: 'Пациент Этап3',
  doctorId: 'doc-e2e',
  doctorName: 'Петров Пётр',
  specializationName: 'Хирург',
  slot: { localDate: '2026-11-20', start: '10:00', end: '10:30' },
};

const letters = [
  ['appointment.submitted.v1', { ...core }],
  ['appointment.approved.v1', { ...core }],
  ['appointment.declined.v1', { ...core, reason: 'Врач заболел' }],
  ['appointment.cancelled.v1', { ...core, previousStatus: 'APPROVED' }],
  [
    'appointment.rescheduled.v1',
    {
      appointmentId: 'e2e-ap-1',
      patientId,
      previousStatus: 'APPROVED',
      old: {
        doctorId: 'doc-e2e',
        doctorName: 'Петров Пётр',
        specializationId: 'sp-e2e',
        specializationName: 'Хирург',
        slot: { localDate: '2026-11-20', start: '10:00', end: '10:30' },
      },
      new: {
        doctorId: 'doc-e2e',
        doctorName: 'Сидоров Сидор',
        specializationId: 'sp-e2e',
        specializationName: 'Кардиолог',
        slot: { localDate: '2026-11-22', start: '14:00', end: '14:30' },
      },
    },
  ],
  ['appointment.completed.v1', { ...core }],
  [
    'document.uploaded.v1',
    {
      key: 'patient/e2e/scan.pdf',
      bucket: 'mp-documents',
      ownerType: 'PATIENT',
      ownerId: patientId,
      mime: 'application/pdf',
      size: 2048,
      category: 'Справка',
      // «загрузил не он сам»: чужой sub ≠ userId владельца → письмо владельцу
      uploadedBy: 'some-doctor-sub',
    },
  ],
];

const greetingsBefore = (await mailTo(email)).length;
for (const [routingKey, payload] of letters) {
  await publish(routingKey, event(payload, crypto.randomUUID()));
}

const expectedSubjects = [
  'Запись отправлена на подтверждение',
  'Запись подтверждена',
  'Запись отклонена',
  'Запись отменена',
  'Запись перенесена',
  'Приём завершён — результаты доступны',
  'Вам загружен документ: Справка',
];

await waitFor(
  async () => {
    const subjects = (await mailTo(email)).map((m) => m.Subject);
    return expectedSubjects.every((s) => subjects.includes(s)) ? subjects : null;
  },
  `письма по всем событиям списка для ${email}`,
  60_000,
);
await sleep(2000); // дать «дублям» проявиться, если они есть
const allSubjects = (await mailTo(email)).map((m) => m.Subject);
if (allSubjects.length !== greetingsBefore + expectedSubjects.length) {
  fail(
    `ожидалось ${greetingsBefore + expectedSubjects.length} писем, получено ${allSubjects.length}: ${allSubjects.join(' | ')}`,
  );
}
ok(`7 событий списка → 7 писем (всего на адресе ${allSubjects.length} с приветствием)`);

// «Загрузил он сам»: uploadedBy = userId владельца → письмо не шлётся (6.2).
await publish(
  'document.uploaded.v1',
  event(
    {
      key: 'patient/e2e/own.pdf',
      bucket: 'mp-documents',
      ownerType: 'PATIENT',
      ownerId: patientId,
      mime: 'application/pdf',
      size: 1024,
      uploadedBy: patientUserId,
    },
    crypto.randomUUID(),
  ),
);
await sleep(3000);
const afterOwnUpload = (await mailTo(email)).length;
if (afterOwnUpload !== allSubjects.length) {
  fail(
    `документ, загруженный самим владельцем, добавил писем: ${allSubjects.length} → ${afterOwnUpload}`,
  );
}
ok('загрузил не он сам → письмо; он сам → пропуск (uploadedBy = userId)');

console.log('\nE2E Этап 3: все проверки пройдены ✓');
