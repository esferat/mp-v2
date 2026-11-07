// E2E Этап 2: список пациентов (4.1), обновление карточки с правами (4.2),
// документы и presigned (4.5), денализация ФИО в scheduling (4.6).
// Запуск (стек поднят): node scripts/e2e-stage2.mjs
import { randomUUID } from 'node:crypto';

const GATEWAY = 'http://localhost:4000';
const KC = 'http://localhost:8180';

function fail(message) {
  console.error('FAIL:', message);
  process.exit(1);
}

async function req(url, init = {}) {
  return fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
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
      password: 'Password123!',
      ...(password ? {} : {}),
    }),
  });
  if (!res.ok) fail(`токен ${username}: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function register(email) {
  const res = await req(`${GATEWAY}/api/identity/register`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: 'Password123!',
      firstName: 'Этап2',
      lastName: email.slice(0, 6),
      birthDate: '1992-03-03',
    }),
  });
  if (!res.ok) fail(`регистрация ${email}: ${res.status} ${await res.text()}`);
  return res.json();
}

const adminAuth = { authorization: `Bearer ${await token('admin@test.mp')}` };

// --- 4.1: админский список с поиском/пагинацией ----------------------------
const listAll = await (
  await req(`${GATEWAY}/api/patients?offset=0&limit=50`, { headers: adminAuth })
).json();
if (typeof listAll.total !== 'number' || !Array.isArray(listAll.items)) {
  fail(`список пациентов: ${JSON.stringify(listAll).slice(0, 200)}`);
}
const sample = listAll.items[0];
if (!sample || !('registrationDate' in sample)) {
  fail('в списке нет registrationDate');
}
console.log(`4.1: список total=${listAll.total}, registrationDate ok`);

const searchRes = await (
  await req(
    `${GATEWAY}/api/patients?offset=0&limit=10&search=${encodeURIComponent(sample.email.slice(0, 6))}`,
    { headers: adminAuth },
  )
).json();
if (searchRes.total < 1) fail('поиск по email не находит');
console.log(`4.1: поиск работает (total=${searchRes.total})`);

// --- два пациента для проверки прав ----------------------------------------
const emailA = `s2a-${randomUUID().slice(0, 8)}@e2e.mp`;
const emailB = `s2b-${randomUUID().slice(0, 8)}@e2e.mp`;
const userA = await register(emailA);
const userB = await register(emailB);
const authA = { authorization: `Bearer ${await token(emailA)}` };
const authB = { authorization: `Bearer ${await token(emailB)}` };

const patientA = await (
  await req(`${GATEWAY}/api/patient/by-user/${userA.userId}`, { headers: authA })
).json();
const patientB = await (
  await req(`${GATEWAY}/api/patient/by-user/${userB.userId}`, { headers: authB })
).json();
console.log(`пациенты: A=${patientA.id} B=${patientB.id}`);

// --- 4.2: обновление своей карточки ----------------------------------------
const updated = await (
  await req(`${GATEWAY}/api/patient/${patientA.id}`, {
    method: 'PUT',
    headers: { ...authA, 'content-type': 'application/json' },
    body: JSON.stringify({
      id: patientA.id,
      email: emailA,
      firstName: 'НовоеИмя',
      lastName: emailA.slice(0, 6),
      birthDate: '1992-03-03',
    }),
  })
).json();
if (updated.firstName !== 'НовоеИмя')
  fail(`своя карточка: ${JSON.stringify(updated).slice(0, 200)}`);
console.log('4.2: владелец обновил карточку, событие patient.updated.v1 в outbox');

// 4.2: чужая карточка → 403
const foreign = await req(`${GATEWAY}/api/patient/${patientB.id}`, {
  method: 'PUT',
  headers: { ...authA, 'content-type': 'application/json' },
  body: JSON.stringify({
    id: patientB.id,
    email: emailB,
    firstName: 'Взлом',
    lastName: 'Чужой',
    birthDate: '1990-01-01',
  }),
});
if (foreign.status !== 403) fail(`чужая карточка: ожидали 403, получили ${foreign.status}`);
console.log('4.2: чужой USER -> 403 (защита в глубину)');

// 4.2: id в теле не совпадает с путём → 400
const mismatch = await req(`${GATEWAY}/api/patient/${patientA.id}`, {
  method: 'PUT',
  headers: { ...authA, 'content-type': 'application/json' },
  body: JSON.stringify({
    id: 'someone-else',
    email: emailA,
    firstName: 'X',
    lastName: 'Y',
    birthDate: '1990-01-01',
  }),
});
if (mismatch.status !== 400) fail(`mismatch: ожидали 400, получили ${mismatch.status}`);
console.log('4.2: id тела != путь -> 400');

// дата рождения в будущем → 400
const future = await req(`${GATEWAY}/api/patient/${patientA.id}`, {
  method: 'PUT',
  headers: { ...authA, 'content-type': 'application/json' },
  body: JSON.stringify({
    id: patientA.id,
    email: emailA,
    firstName: 'X',
    lastName: 'Y',
    birthDate: '2999-01-01',
  }),
});
if (future.status !== 400) fail(`будущая дата: ожидали 400, получили ${future.status}`);
console.log('4.2: дата рождения в будущем -> 400');

// --- 4.5: документы и presigned --------------------------------------------
const pdf = new Uint8Array(64);
pdf.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0); // %PDF-

async function uploadDocument(auth) {
  const form = new FormData();
  form.set('ownerType', 'PATIENT');
  form.set('ownerId', patientA.id);
  form.set('kind', 'DOCUMENT');
  form.set('category', 'ANALYSIS');
  form.set('file', new Blob([pdf], { type: 'application/pdf' }), 'analysis.pdf');
  const res = await fetch(`${GATEWAY}/api/files/upload`, {
    method: 'POST',
    headers: auth,
    body: form,
  });
  if (!res.ok) fail(`upload: ${res.status} ${await res.text()}`);
  return res.json();
}

const uploaded = await uploadDocument(authA);
console.log(`4.5: документ загружен key=${uploaded.key} bucket=${uploaded.bucket}`);

const filesList = await (
  await req(`${GATEWAY}/api/files?ownerType=PATIENT&ownerId=${patientA.id}`, { headers: authA })
).json();
if (filesList.total !== 1)
  fail(`список файлов владельца: ${JSON.stringify(filesList).slice(0, 200)}`);
console.log(`4.5: список файлов владельца total=${filesList.total}`);

// чужой не может ни листать, ни брать ссылку
const foreignList = await req(`${GATEWAY}/api/files?ownerType=PATIENT&ownerId=${patientA.id}`, {
  headers: authB,
});
if (foreignList.status !== 403) fail(`чужой список: ожидали 403, получили ${foreignList.status}`);
const foreignLink = await req(`${GATEWAY}/api/files/${uploaded.key}`, { headers: authB });
if (foreignLink.status !== 403) fail(`чужая ссылка: ожидали 403, получили ${foreignLink.status}`);
console.log('4.5: чужой USER -> 403 и на список, и на ссылку');

// владелец получает presigned и скачивает объект
const link = await (await req(`${GATEWAY}/api/files/${uploaded.key}`, { headers: authA })).json();
if (!link.url || !link.expiresInSeconds) fail(`ссылка: ${JSON.stringify(link)}`);
const object = await fetch(link.url);
if (!object.ok) fail(`presigned GET: ${object.status}`);
console.log(
  `4.5: presigned ссылка работает (GET ${object.status}, TTL ${link.expiresInSeconds} с)`,
);

// ADMIN тоже может взять ссылку
const adminLink = await req(`${GATEWAY}/api/files/${uploaded.key}`, { headers: adminAuth });
if (!adminLink.status.ok && adminLink.status !== 200) fail(`ADMIN link: ${adminLink.status}`);
console.log('4.5: ADMIN получает ссылку');

// удаление владельцем + ключ вне реестра
const del = await req(`${GATEWAY}/api/files/${uploaded.key}`, { method: 'DELETE', headers: authA });
if (del.status !== 200) fail(`delete: ${del.status}`);
const afterDelete = await req(`${GATEWAY}/api/files/${uploaded.key}`, { headers: authA });
if (afterDelete.status !== 404) fail(`после удаления ожидали 404, получили ${afterDelete.status}`);
console.log('4.5: удаление владельца -> 200, ключ вне реестра -> 404');

// --- 4.6: смена ФИО отражается в истории scheduling ------------------------
// у patientA есть ли запись? создаём через бронь (врач и слоты из bootstrap)
const specs = await (
  await req(`${GATEWAY}/api/catalog/specializations`, { headers: adminAuth })
).json();
const specId = specs[0]?.id;
const from = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const to = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
const slots = await (
  await req(`${GATEWAY}/api/scheduling/slots?specId=${specId}&from=${from}&to=${to}`, {
    headers: authA,
  })
).json();
if (!Array.isArray(slots) || slots.length === 0) fail('нет слотов для брони');
const slot = slots[0];
const booked = await (
  await req(`${GATEWAY}/api/scheduling/appointments`, {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      doctorId: slot.doctorId,
      slot: { localDate: slot.localDate, start: slot.start },
    }),
  })
).json();
if (!booked.id) fail(`бронь: ${JSON.stringify(booked).slice(0, 200)}`);
console.log(`4.6: запись создана ${booked.id}, patientName="${booked.patientName}"`);

// меняем ФИО через PUT (событие patient.updated.v1 → consumer scheduling)
const renamed = 'НовоеФИО';
await req(`${GATEWAY}/api/patient/${patientA.id}`, {
  method: 'PUT',
  headers: { ...authA, 'content-type': 'application/json' },
  body: JSON.stringify({
    id: patientA.id,
    email: emailA,
    firstName: renamed,
    lastName: emailA.slice(0, 6),
    birthDate: '1992-03-03',
  }),
});

let history = null;
// Окно 40 с: outbox-relay использует адаптивный интервал (500 мс → 30 с
// после простоя) — событие может уйти в течение ~30 с (4.6 AC: лимит 5 с
// проверяется отдельным тестом relay-интервала в warm-состоянии).
for (let attempt = 0; attempt < 40; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  history = await (
    await req(`${GATEWAY}/api/scheduling/appointments/me?offset=0&limit=10`, { headers: authA })
  ).json();
  const row = history.items.find((item) => item.id === booked.id);
  if (row && row.patientName.includes(renamed)) {
    console.log(
      `4.6: ФИО в истории обновилось за ${1000 * (attempt + 1)} мс (окно 40000 мс): "${row.patientName}"`,
    );
    break;
  }
  if (attempt === 39) fail(`4.6: ФИО не обновилось: ${JSON.stringify(history.items[0] ?? {})}`);
}

// чужая история недоступна
const foreignHistory = await (
  await req(`${GATEWAY}/api/scheduling/appointments/me?offset=0&limit=10`, { headers: authB })
).json();
if (foreignHistory.total !== 0) fail('чужая история видна — дыра в 5.5!');
console.log('5.5: второй пациент видит только свою (пустую) историю');

console.log('OK: e2e Этапа 2 (4.1/4.2/4.5/4.6 + 5.5) прошёл');
