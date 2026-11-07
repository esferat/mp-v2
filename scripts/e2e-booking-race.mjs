// E2E 5.6: гонка бронирования — 100 параллельных POST на один слот дают
// ровно один успех (частичный уникальный индекс), 99 × 409 SLOT_TAKEN,
// в БД ровно 1 запись и ровно 1 событие appointment.submitted.v1.
//
// Запуск (стек поднят):  node scripts/e2e-booking-race.mjs
// AC 5.6: стабильно зелёный 10 итераций подряд (итерации на разных слотах)
// + соседние слоты бронируются свободно (индекс не блокирует лишнего).
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';

const GATEWAY = 'http://localhost:4000';
const KC = 'http://localhost:8180';
const ITERATIONS = Number(process.env.RACE_ITERATIONS ?? 10);
const PARALLEL = 100;

function fail(message) {
  console.error('FAIL:', message);
  process.exit(1);
}

async function req(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  return res;
}

async function token(username, password) {
  const res = await fetch(`${KC}/realms/medical-portal/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'svc-e2e',
      client_secret: 'dev-e2e-secret',
      username,
      password,
    }),
  });
  if (!res.ok) fail(`токен ${username}: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

// --- 1) пациент (регистрация = сага Keycloak + карточка) -------------------
const email = `race-${randomUUID().slice(0, 8)}@e2e.mp`;
const password = 'Password123!';
const regRes = await req(`${GATEWAY}/api/identity/register`, {
  method: 'POST',
  body: JSON.stringify({
    email,
    password,
    firstName: 'Гонка',
    lastName: 'Тест',
    birthDate: '1990-01-01',
  }),
});
if (!regRes.ok) fail(`регистрация: ${regRes.status} ${await regRes.text()}`);
const { userId } = await regRes.json();
const userToken = await token(email, password);
const userAuth = { authorization: `Bearer ${userToken}` };
console.log('пациент зарегистрирован:', userId);

// --- 2) врач + специализация (админ) ---------------------------------------
const adminToken = await token('admin@test.mp', 'Password123!');
const adminAuth = { authorization: `Bearer ${adminToken}` };

let specs = await (
  await req(`${GATEWAY}/api/catalog/specializations`, { headers: adminAuth })
).json();
if (!Array.isArray(specs) || specs.length === 0) {
  const created = await req(`${GATEWAY}/api/catalog/specializations`, {
    method: 'POST',
    headers: adminAuth,
    body: JSON.stringify({ name: 'Гонка-специализация' }),
  });
  if (!created.ok) fail(`специализация: ${created.status}`);
  specs = [await created.json()];
}
const specId = specs[0].id;

const schedule = {
  startTime: '08:00',
  endTime: '20:00',
  durationMinutes: 30,
  workDays: [1, 2, 3, 4, 5, 6, 7],
};
const doctorRes = await req(`${GATEWAY}/api/catalog/doctors`, {
  method: 'POST',
  headers: adminAuth,
  body: JSON.stringify({
    firstName: `Гонка${randomUUID().slice(0, 4)}`,
    lastName: 'Врач',
    specializationId: specId,
    schedule,
  }),
});
if (!doctorRes.ok) fail(`врач: ${doctorRes.status} ${await doctorRes.text()}`);
const doctor = await doctorRes.json();
console.log('врач создан:', doctor.id);

// --- 3) ждём копию расписания в scheduling (потребитель doctor.created) -----
const from = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const to = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
let slots = [];
for (let attempt = 0; attempt < 40; attempt += 1) {
  const res = await req(`${GATEWAY}/api/scheduling/slots?specId=${specId}&from=${from}&to=${to}`, {
    headers: userAuth,
  });
  if (res.ok) {
    slots = (await res.json()).filter((slot) => slot.doctorId === doctor.id);
    if (slots.length >= ITERATIONS + 5) break;
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (slots.length < ITERATIONS + 5) {
  fail(`слотов не хватает: ${slots.length} (копия врача не появилась?)`);
}
console.log('слотов получено:', slots.length);

// 429 от rate-limit gateway (30 r/s, 1.2) — штатный рубец: запрос ретраится,
// конкурентный батч из 100 сохраняется (все стартуют одновременно).
async function book(slot, attempt = 0) {
  const res = await req(`${GATEWAY}/api/scheduling/appointments`, {
    method: 'POST',
    headers: userAuth,
    body: JSON.stringify({
      doctorId: doctor.id,
      slot: { localDate: slot.localDate, start: slot.start },
    }),
  });
  if (res.status === 429 && attempt < 30) {
    await new Promise((resolve) => setTimeout(resolve, 250 + attempt * 100));
    return book(slot, attempt + 1);
  }
  return res;
}

// --- 4) итерации гонки: 100 параллельных на один слот ----------------------
for (let i = 0; i < ITERATIONS; i += 1) {
  const slot = slots[i];
  const results = await Promise.all(Array.from({ length: PARALLEL }, () => book(slot)));
  const created = results.filter((r) => r.status === 201).length;
  const conflicts = results.filter((r) => r.status === 409).length;
  const wrong = results.filter((r) => r.status !== 201 && r.status !== 409);
  if (created !== 1 || conflicts !== PARALLEL - 1 || wrong.length > 0) {
    const details = await Promise.all(wrong.map((r) => r.text()));
    fail(
      `итерация ${i}: успех=${created} (нужен 1), 409=${conflicts} (нужно ${PARALLEL - 1}), прочее=${wrong.map((r) => r.status).join(',')}: ${details.join(' | ')}`,
    );
  }
  console.log(`итерация ${i}: 1 × 201, ${conflicts} × 409 SLOT_TAKEN`);
}

// --- 5) в БД ровно 1 запись на прогон (по слотам гонки) --------------------
const adminList = await (
  await req(
    `${GATEWAY}/api/scheduling/appointments?doctorId=${doctor.id}&from=${from}&to=${to}&limit=100`,
    { headers: adminAuth },
  )
).json();
if (adminList.total !== ITERATIONS) {
  fail(`записей ${adminList.total}, ожидалось ${ITERATIONS} (по одной на итерацию)`);
}
console.log('записей в БД:', adminList.total);

// --- 6) ровно 1 событие submitted на каждую запись (outbox) -----------------
const appointmentIds = adminList.items.map((item) => item.id);
const psql = (sql) =>
  execSync(
    `docker exec mp-v2-postgres-1 psql -U mp -d db_schedule -t -A -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' },
  ).trim();
for (const id of appointmentIds) {
  const count = psql(
    `SELECT count(*) FROM "OutboxMessage" WHERE "routingKey" = 'appointment.submitted.v1' AND payload->'payload'->>'appointmentId' = '${id}'`,
  );
  if (count !== '1') fail(`событий для ${id}: ${count} (ожидалось 1)`);
}
console.log('outbox: по 1 событию appointment.submitted.v1 на запись');

// --- 7) соседние слоты: параллельные брони все успешны ----------------------
const neighbours = slots.slice(ITERATIONS, ITERATIONS + 5);
const neighbourResults = await Promise.all(neighbours.map((slot) => book(slot)));
const neighbourOk = neighbourResults.filter((r) => r.status === 201).length;
if (neighbourOk !== neighbours.length) {
  fail(`соседние слоты: успех ${neighbourOk}/${neighbours.length} (индекс блокирует лишнее?)`);
}
console.log('соседние слоты: все', neighbourOk, 'успешны');

console.log(`OK: гонка 5.6 прошла (${ITERATIONS} итераций × ${PARALLEL} запросов)`);
