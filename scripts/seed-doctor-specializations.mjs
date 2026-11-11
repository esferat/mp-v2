// Dev-seed стенда: добавляет специальности врачей и распределяет по ним
// существующих докторов (задача: «5–7 специальностей, распределить врачей»).
//
// Идемпотентно: уже созданные специальности не дублируются; в исходной
// «Терапевт (e2e)» остаётся KEEP врачей (е2e-скрипты ищут слоты именно её),
// избыток распределяется round-robin по новым специальностям.
//
// Запуск (стенд поднят):
//   node scripts/seed-doctor-specializations.mjs
// Окружение: KC (default http://localhost:8180), GW (default http://localhost:4000).
const GW = process.env.GW ?? 'http://localhost:4000';
const KC = process.env.KC ?? 'http://localhost:8180';

const NEW_SPECS = [
  'Кардиолог',
  'Хирург',
  'Невролог',
  'Дерматолог',
  'Офтальмолог',
  'Отоларинголог',
  'Эндокринолог',
];
const SOURCE_SPEC = 'Терапевт (e2e)';
const KEEP = 6; // врачей остаются в исходной специализации (нужны e2e)

const PASSWORD = process.env.ADMIN_PASSWORD ?? 'Password123!';

function fail(message) {
  console.error('FAIL:', message);
  process.exit(1);
}

async function adminToken() {
  const res = await fetch(`${KC}/realms/medical-portal/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'svc-e2e',
      client_secret: 'dev-e2e-secret',
      username: 'admin@test.mp',
      password: PASSWORD,
    }),
  });
  if (!res.ok) fail(`токен админа: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function api(token, path, init = {}) {
  const res = await fetch(`${GW}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) fail(`${init.method ?? 'GET'} ${path} → ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const token = await adminToken();

// --- 1) специальности: создать недостающие -----------------------------------
const specs = await api(token, '/api/catalog/specializations');
const byName = new Map(specs.map((spec) => [spec.name, spec.id]));
const created = [];
for (const name of NEW_SPECS) {
  if (byName.has(name)) continue;
  const spec = await api(token, '/api/catalog/specializations', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  byName.set(name, spec.id);
  created.push(name);
}
console.log(
  created.length > 0
    ? `создано специализаций: ${created.join(', ')}`
    : 'все специальности уже есть — дублей не создано',
);

const sourceId = byName.get(SOURCE_SPEC);
if (!sourceId) fail(`исходная специализация «${SOURCE_SPEC}» не найдена`);

// --- 2) врачи исходной специализации ----------------------------------------
const source = await api(token, `/api/catalog/doctors?specId=${sourceId}&limit=100`);
const doctors = source.items;
console.log(`врачей в «${SOURCE_SPEC}»: ${doctors.length} (оставляем ${KEEP})`);

if (doctors.length <= KEEP) {
  console.log('распределять нечего — остановка');
  process.exit(0);
}

// --- 3) распределение избытка round-robin по новым специальностям ------------
const targets = NEW_SPECS.map((name) => ({ name, id: byName.get(name) }));
const excess = doctors.slice(KEEP);
let moved = 0;
for (let i = 0; i < excess.length; i += 1) {
  const doctor = excess[i];
  const target = targets[i % targets.length];
  if (!target.id) continue;
  // Нормализация расписания к валидному виду: durationMinutes ∈ {5,10,15,20,30}
  // (иначе PUT дал бы 400 — контракт 3.2, «слоты должны быть валидны»).
  // Значение округляется до ближайшего допустимого, врач переносится как все.
  const VALID_DURATIONS = [5, 10, 15, 20, 30];
  const duration = doctor.schedule.durationMinutes;
  let schedule = doctor.schedule;
  if (!VALID_DURATIONS.includes(duration)) {
    const normalized = VALID_DURATIONS.reduce((best, value) =>
      Math.abs(value - duration) < Math.abs(best - duration) ? value : best,
    );
    console.warn(
      `нормализация расписания: duration ${duration} → ${normalized} мин (${doctor.lastName} ${doctor.firstName})`,
    );
    schedule = { ...doctor.schedule, durationMinutes: normalized };
  }
  await api(token, `/api/catalog/doctors/${doctor.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      id: doctor.id,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      ...(doctor.middleName ? { middleName: doctor.middleName } : {}),
      specializationId: target.id,
      schedule,
      status: doctor.status,
      ...(doctor.userId ? { userId: doctor.userId } : {}),
    }),
  });
  moved += 1;
}
console.log(
  `перенесено врачей: ${moved} (по ${Math.ceil(moved / targets.length)} на специализацию)`,
);

// --- 4) итоговое распределение ------------------------------------------------
const all = await api(token, '/api/catalog/doctors?limit=100');
const counts = new Map();
for (const doctor of all.items) {
  counts.set(doctor.specializationName, (counts.get(doctor.specializationName) ?? 0) + 1);
}
console.log('--- итог ---');
for (const [name, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${count}\t${name}`);
}
