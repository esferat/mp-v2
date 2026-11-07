// Seed dev-аккаунтов: 2 пользователя каждой роли в живом реалме Keycloak
// + карточки Patient/Doctor, чтобы кабинеты работали сразу.
// Идемпотентен: повторный запуск не создаёт дублей.
//
// Запуск: node scripts/seed-test-users.mjs   (стек поднят)
import { readFileSync } from 'node:fs';

const KC = 'http://localhost:8180';
const GATEWAY = 'http://localhost:4000';
const REALM = 'medical-portal';
const PASSWORD = 'Password123!';

function fail(message) {
  console.error('FAIL:', message);
  process.exit(1);
}

async function req(url, init = {}) {
  const isForm = init.body instanceof URLSearchParams;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(isForm
        ? { 'content-type': 'application/x-www-form-urlencoded' }
        : { 'content-type': 'application/json' }),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok)
    throw new Error(`${init.method ?? 'GET'} ${url} -> ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// --- admin-токен (Admin API + gateway) ---------------------------------------
const adminTok = await req(`${KC}/realms/master/protocol/openid-connect/token`, {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: 'admin',
    password: 'admin',
  }),
});
const auth = { authorization: `Bearer ${adminTok.access_token}` };

const e2eTok = await req(`${KC}/realms/${REALM}/protocol/openid-connect/token`, {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'password',
    client_id: 'svc-e2e',
    client_secret: 'dev-e2e-secret',
    username: 'admin@test.mp',
    password: PASSWORD,
  }),
});
const gwAuth = { authorization: `Bearer ${e2eTok.access_token}` };

// --- пользователи (манифест — источник имён/ролей) ---------------------------
const manifest = JSON.parse(
  readFileSync(new URL('../infra/keycloak/realm-medical-portal.json', import.meta.url), 'utf8'),
);
const wanted = manifest.users.filter((u) => Array.isArray(u.realmRoles) && u.realmRoles.length > 0);

const subs = new Map(); // username → Keycloak sub
for (const user of wanted) {
  const existing = await req(
    `${KC}/admin/realms/${REALM}/users?username=${encodeURIComponent(user.username)}&exact=true`,
    { headers: auth },
  );
  if (existing.length > 0) {
    subs.set(user.username, existing[0].id);
    console.log(`есть: ${user.username}`);
    continue;
  }
  const created = await req(`${KC}/admin/realms/${REALM}/users`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      username: user.username,
      email: user.email ?? user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      enabled: true,
      emailVerified: user.emailVerified ?? true,
      credentials: [{ type: 'password', value: PASSWORD, temporary: false }],
    }),
  });
  if (created !== null) throw new Error(`Keycloak не вернул пустой ответ: ${user.username}`);
  const after = await req(
    `${KC}/admin/realms/${REALM}/users?username=${encodeURIComponent(user.username)}&exact=true`,
    { headers: auth },
  );
  subs.set(user.username, after[0].id);
  console.log(`создан: ${user.username}`);

  // realm-роли
  for (const roleName of user.realmRoles) {
    const role = await req(`${KC}/admin/realms/${REALM}/roles/${roleName}`, { headers: auth });
    await req(`${KC}/admin/realms/${REALM}/users/${after[0].id}/role-mappings/realm`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify([{ id: role.id, name: role.name }]),
    });
  }
  console.log(`  роли: ${user.realmRoles.join(', ')}`);
}

// --- карточки пациентов (patient-service) ------------------------------------
const patients = wanted.filter((u) => u.realmRoles.includes('USER'));
for (const user of patients) {
  const sub = subs.get(user.username);
  const existing = await req(`${GATEWAY}/api/patient/by-user/${sub}`, { headers: gwAuth }).catch(
    () => null,
  );
  if (existing && existing.id) {
    console.log(`карточка есть: ${user.username} (${existing.id})`);
    continue;
  }
  const card = await req(`${GATEWAY}/api/patient`, {
    method: 'POST',
    headers: gwAuth,
    body: JSON.stringify({
      userId: sub,
      email: user.email ?? user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      birthDate: '1990-01-01',
    }),
  });
  console.log(`карточка пациента: ${user.username} -> ${card.id}`);
}

// --- врачи: карточка в catalog с привязкой userId ---------------------------
const doctors = wanted.filter((u) => u.realmRoles.includes('DOCTOR'));
let specs = await req(`${GATEWAY}/api/catalog/specializations`, { headers: gwAuth });
if (!Array.isArray(specs) || specs.length === 0) {
  const spec = await req(`${GATEWAY}/api/catalog/specializations`, {
    method: 'POST',
    headers: gwAuth,
    body: JSON.stringify({ name: 'Терапевт' }),
  });
  specs = [spec];
}
const specId = specs[0].id;

const schedule = {
  startTime: '09:00',
  endTime: '18:00',
  durationMinutes: 30,
  workDays: [1, 2, 3, 4, 5],
};

for (const user of doctors) {
  const sub = subs.get(user.username);
  const doctorsList = await req(`${GATEWAY}/api/catalog/doctors?limit=100`, { headers: gwAuth });
  const existing = doctorsList.items.find((d) => d.userId === sub);
  if (existing) {
    console.log(`карточка врача есть: ${user.username} (${existing.id})`);
    continue;
  }
  const doctor = await req(`${GATEWAY}/api/catalog/doctors`, {
    method: 'POST',
    headers: gwAuth,
    body: JSON.stringify({
      userId: sub,
      firstName: user.firstName,
      lastName: user.lastName,
      specializationId: specId,
      schedule,
    }),
  });
  console.log(`карточка врача: ${user.username} -> ${doctor.id}`);
}

console.log(`OK: ${wanted.length} аккаунтов готовы (пароль: ${PASSWORD})`);
