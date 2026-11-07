// E2E Эпика 9: 9.1 (сага врача с учётной записью DOCTOR, идемпотентность),
// 9.2 (приёмы врача, результат приёма APPROVED → COMPLETED), 9.3 (доступ
// врача к документам пациента по действующей связи).
// Запуск (стек поднят): node scripts/e2e-epic9.mjs
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

async function token(username, password = 'Password123!') {
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

const suffix = randomUUID().slice(0, 6);
const doctorEmail = `e9-doc-${suffix}@e2e.mp`;
const patientEmail = `e9-pt-${suffix}@e2e.mp`;

// --- 9.1: сага врача (ADMIN) ----------------------------------------------
const adminAuth = { authorization: `Bearer ${await token('admin@test.mp')}` };

const schedule = {
  startTime: '09:00',
  endTime: '18:00',
  durationMinutes: 30,
  workDays: [1, 2, 3, 4, 5, 6, 7],
};

let specs = await (
  await req(`${GATEWAY}/api/catalog/specializations`, { headers: adminAuth })
).json();
if (!Array.isArray(specs) || !specs.length) {
  const created = await req(`${GATEWAY}/api/catalog/specializations`, {
    method: 'POST',
    headers: adminAuth,
    body: JSON.stringify({ name: `E9-${suffix}` }),
  });
  if (!created.ok) fail(`специализация: ${created.status}`);
  specs = [await created.json()];
}
const specId = specs[0].id;

const saga1 = await req(`${GATEWAY}/api/identity/doctors`, {
  method: 'POST',
  headers: adminAuth,
  body: JSON.stringify({
    email: doctorEmail,
    password: 'Password123!',
    firstName: 'Этап9',
    lastName: `Докт${suffix}`,
    specializationId: specId,
    schedule,
  }),
});
if (!saga1.ok) fail(`сага врача: ${saga1.status} ${await saga1.text()}`);
const doctor = await saga1.json();
console.log(`9.1: врач создан doctorId=${doctor.doctorId}, userId=${doctor.userId}`);

// идемпотентность: повтор по тому же email не плодит пользователей
const saga2 = await req(`${GATEWAY}/api/identity/doctors`, {
  method: 'POST',
  headers: adminAuth,
  body: JSON.stringify({
    email: doctorEmail,
    password: 'Password123!',
    firstName: 'Этап9',
    lastName: `Докт${suffix}`,
    specializationId: specId,
    schedule,
  }),
});
if (!saga2.ok) fail(`повтор саги: ${saga2.status}`);
const doctor2 = await saga2.json();
if (doctor2.userId !== doctor.userId) {
  fail(`повтор создал ДРУГОГО пользователя: ${doctor.userId} != ${doctor2.userId}`);
}
console.log('9.1: повтор по email идемпотентен (пользователь переиспользован)');

// ADMIN не должен создавать дубль врача с тем же userId (unique) — это уже
// проверено выше: saga2 создала ВТОРОГО врача? Нет: смотрим, сколько врачей
// с этим userId в каталоге
const doctorList = await (
  await req(`${GATEWAY}/api/catalog/doctors?limit=100`, { headers: adminAuth })
).json();
const withUser = doctorList.items.filter((item) => item.userId === doctor.userId);
if (withUser.length !== 1) {
  fail(`врачей с userId=${doctor.userId}: ${withUser.length} (ожидалось 1)`);
}
console.log('9.1: у userId ровно одна карточка врача (связка user ↔ doctor)');

// --- вход врача: токен, роль DOCTOR ----------------------------------------
const doctorAuth = { authorization: `Bearer ${await token(doctorEmail)}` };

// 9.2: приёмы врача (пока пусто)
const myAppointments = await (
  await req(`${GATEWAY}/api/scheduling/appointments/doctor?offset=0&limit=10`, {
    headers: doctorAuth,
  })
).json();
if (typeof myAppointments.total !== 'number') {
  fail(`приёмы врача: ${JSON.stringify(myAppointments).slice(0, 200)}`);
}
console.log(`9.2: приёмы врача доступны (total=${myAppointments.total})`);

// пациент и бронь (админ бронирует явного пациента)
const reg = await req(`${GATEWAY}/api/identity/register`, {
  method: 'POST',
  body: JSON.stringify({
    email: patientEmail,
    password: 'Password123!',
    firstName: 'Пациент',
    lastName: `E9-${suffix}`,
    birthDate: '1990-05-05',
  }),
});
if (!reg.ok) fail(`регистрация пациента: ${reg.status} ${await reg.text()}`);
const { userId: patientUserId } = await reg.json();

const patientCard = await (
  await req(`${GATEWAY}/api/patient/by-user/${patientUserId}`, { headers: adminAuth })
).json();

const from = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const to = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
let slots = [];
for (let attempt = 0; attempt < 40; attempt += 1) {
  const res = await req(`${GATEWAY}/api/scheduling/slots?specId=${specId}&from=${from}&to=${to}`, {
    headers: adminAuth,
  });
  if (res.ok) {
    slots = (await res.json()).filter((slot) => slot.doctorId === doctor.doctorId);
    if (slots.length > 0) break;
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (slots.length === 0) fail('нет слотов нового врача (копия расписания не появилась?)');
console.log(`слоты врача получены: ${slots.length}`);

const booked = await (
  await req(`${GATEWAY}/api/scheduling/appointments`, {
    method: 'POST',
    headers: adminAuth,
    body: JSON.stringify({
      doctorId: doctor.doctorId,
      patientId: patientCard.id,
      slot: { localDate: slots[0].localDate, start: slots[0].start },
    }),
  })
).json();
if (!booked.id) fail(`бронь: ${JSON.stringify(booked).slice(0, 200)}`);
console.log(`запись создана ${booked.id} (SUBMITTED)`);

// 9.3 ДО принятия записи: врача нет в записях → документов нет, связь false
const beforeApproval = await req(
  `${GATEWAY}/api/files?ownerType=PATIENT&ownerId=${patientCard.id}`,
  { headers: doctorAuth },
);
if (beforeApproval.status !== 403) {
  fail(`доступ до APPROVED: ожидали 403, получили ${beforeApproval.status}`);
}
console.log('9.3: до принятия записи врач не видит документы (403)');

// --- админ принимает запись -------------------------------------------------
const approved = await req(`${GATEWAY}/api/scheduling/appointments/${booked.id}/status`, {
  method: 'PUT',
  headers: adminAuth,
  body: JSON.stringify({ status: 'APPROVED' }),
});
if (!approved.ok) fail(`approve: ${approved.status} ${await approved.text()}`);
console.log('запись APPROVED');

// --- 9.2: врач вносит результат приёма --------------------------------------
const entered = await req(`${GATEWAY}/api/scheduling/appointments/${booked.id}/result`, {
  method: 'POST',
  headers: doctorAuth,
  body: JSON.stringify({
    conclusion: 'Осмотр завершён',
    recommendations: 'Контроль через 14 дней',
  }),
});
if (!entered.ok) fail(`внесение результата: ${entered.status} ${await entered.text()}`);
const result = await entered.json();
console.log(`9.2: результат внесён appointmentId=${result.appointmentId}`);

// статус записи стал COMPLETED
const afterResult = await (
  await req(`${GATEWAY}/api/scheduling/appointments/doctor?offset=0&limit=10`, {
    headers: doctorAuth,
  })
).json();
const completed = afterResult.items.find((item) => item.id === booked.id);
if (!completed || completed.status !== 'COMPLETED') {
  fail(`статус после результата: ${completed?.status ?? 'записи нет'} (ожидался COMPLETED)`);
}
if (!completed.visitResult || completed.visitResult.conclusion !== 'Осмотр завершён') {
  fail(`visitResult в списке: ${JSON.stringify(completed.visitResult)}`);
}
console.log('9.2: запись COMPLETED, результат виден в списке врача');

// повтор (идемпотентность) → 200 с тем же результатом
const repeat = await req(`${GATEWAY}/api/scheduling/appointments/${booked.id}/result`, {
  method: 'POST',
  headers: doctorAuth,
  body: JSON.stringify({ conclusion: 'Осмотр завершён' }),
});
if (!repeat.ok) fail(`повтор результата: ${repeat.status} (ожидался 200 идемпотентно)`);
console.log('9.2: повтор внесения идемпотентен (200)');

// правка результата врачом
const edited = await req(`${GATEWAY}/api/scheduling/appointments/${booked.id}/result`, {
  method: 'PUT',
  headers: doctorAuth,
  body: JSON.stringify({ conclusion: 'Осмотр завершён (уточнено)' }),
});
if (!edited.ok) fail(`правка результата: ${edited.status}`);
console.log('9.2: правка результата работает');

// чужой врач (доктор@test.mp) → 403 на результат и на приёмы
const foreignDoctorAuth = { authorization: `Bearer ${await token('doctor@test.mp')}` };
const foreignResult = await req(`${GATEWAY}/api/scheduling/appointments/${booked.id}/result`, {
  headers: foreignDoctorAuth,
});
if (foreignResult.status !== 403) {
  fail(`чужой врач читает результат: ожидали 403, получили ${foreignResult.status}`);
}
const foreignListRes = await req(
  `${GATEWAY}/api/scheduling/appointments/doctor?offset=0&limit=10`,
  { headers: foreignDoctorAuth },
);
if (foreignListRes.status === 403) {
  console.log('9.2: врач без привязки userId -> 403 на приёмы (защита в глубину)');
} else if (foreignListRes.ok) {
  const foreignList = await foreignListRes.json();
  if (foreignList.items.some((item) => item.id === booked.id)) {
    fail('чужой врач видит запись другого врача!');
  }
  console.log('9.2: чужой врач не видит чужие записи');
} else {
  fail(`приёмы чужого врача: ${foreignListRes.status}`);
}

// --- 9.3: врач с действующей записью ---------------------------------------
const pdf = new Uint8Array(64);
pdf.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0); // %PDF-

async function uploadDocument(auth) {
  const form = new FormData();
  form.set('ownerType', 'PATIENT');
  form.set('ownerId', patientCard.id);
  form.set('kind', 'DOCUMENT');
  form.set('category', 'ANALYSIS');
  form.set('file', new Blob([pdf], { type: 'application/pdf' }), 'scan.pdf');
  const res = await fetch(`${GATEWAY}/api/files/upload`, {
    method: 'POST',
    headers: auth,
    body: form,
  });
  if (!res.ok) fail(`загрузка врачом: ${res.status} ${await res.text()}`);
  return res.json();
}

const doctorUpload = await uploadDocument(doctorAuth);
console.log(`9.3: врач загрузил документ key=${doctorUpload.key}`);

const doctorFiles = await (
  await req(`${GATEWAY}/api/files?ownerType=PATIENT&ownerId=${patientCard.id}`, {
    headers: doctorAuth,
  })
).json();
if (doctorFiles.total < 1) fail(`список документов врачем: ${JSON.stringify(doctorFiles)}`);
console.log(`9.3: врач видит документы (total=${doctorFiles.total})`);

const doctorLink = await req(`${GATEWAY}/api/files/${doctorUpload.key}`, {
  headers: doctorAuth,
});
if (!doctorLink.ok) fail(`presigned врачем: ${doctorLink.status}`);
const doctorObject = await fetch((await doctorLink.json()).url);
if (!doctorObject.ok) fail(`объект по ссылке врача: ${doctorObject.status}`);
console.log(`9.3: врач скачивает документ (GET ${doctorObject.status})`);

// привязка sub → doctorId
const doctorByUser = await req(`${GATEWAY}/api/scheduling/relations/doctor/${doctor.userId}`, {
  headers: adminAuth,
});
if (!doctorByUser.ok) fail(`relations/doctor: ${doctorByUser.status}`);
const relation = await doctorByUser.json();
if (relation.doctorId !== doctor.doctorId) {
  fail(`привязка: ${relation.doctorId} != ${doctor.doctorId}`);
}
console.log('9.3: привязка sub → doctorId работает');

// --- 9.3: потеря связи закрывает доступ -------------------------------------
// Отдельный пациент: его ЕДИНСТВЕННАЯ запись отменяется → связи не остаётся
// (COMPLETED терминален по канону §1, поэтому сценарий на второй записи)
const patient2Email = `e9-pt2-${suffix}@e2e.mp`;
const reg2 = await req(`${GATEWAY}/api/identity/register`, {
  method: 'POST',
  body: JSON.stringify({
    email: patient2Email,
    password: 'Password123!',
    firstName: 'Второй',
    lastName: `E9-${suffix}`,
    birthDate: '1988-08-08',
  }),
});
if (!reg2.ok) fail(`регистрация второго пациента: ${reg2.status}`);
const { userId: patient2UserId } = await reg2.json();
const patient2Card = await (
  await req(`${GATEWAY}/api/patient/by-user/${patient2UserId}`, { headers: adminAuth })
).json();

const slot2 = slots.find((s) => s.localDate !== slots[0].localDate || s.start !== slots[0].start);
if (!slot2) fail('нет второго слота для сценария потери связи');
const booked2 = await (
  await req(`${GATEWAY}/api/scheduling/appointments`, {
    method: 'POST',
    headers: adminAuth,
    body: JSON.stringify({
      doctorId: doctor.doctorId,
      patientId: patient2Card.id,
      slot: { localDate: slot2.localDate, start: slot2.start },
    }),
  })
).json();
if (!booked2.id) fail(`вторая бронь: ${JSON.stringify(booked2).slice(0, 200)}`);
await req(`${GATEWAY}/api/scheduling/appointments/${booked2.id}/status`, {
  method: 'PUT',
  headers: adminAuth,
  body: JSON.stringify({ status: 'APPROVED' }),
});

// пока запись действует — врач видит документы второго пациента
const doc2Form = new FormData();
doc2Form.set('ownerType', 'PATIENT');
doc2Form.set('ownerId', patient2Card.id);
doc2Form.set('kind', 'DOCUMENT');
doc2Form.set('category', 'OTHER');
doc2Form.set('file', new Blob([pdf], { type: 'application/pdf' }), 'before.pdf');
const doc2Res = await fetch(`${GATEWAY}/api/files/upload`, {
  method: 'POST',
  headers: doctorAuth,
  body: doc2Form,
});
if (!doc2Res.ok) fail(`загрузка при действующей записи: ${doc2Res.status}`);
const doc2 = await doc2Res.json();
console.log('9.3: при действующей записи врач загружает документ второму пациенту');

const cancelled = await req(`${GATEWAY}/api/scheduling/appointments/${booked2.id}/cancel`, {
  method: 'PUT',
  headers: adminAuth,
  body: JSON.stringify({ reason: 'Пациент не может прийти' }),
});
if (!cancelled.ok) fail(`cancel: ${cancelled.status} ${await cancelled.text()}`);
console.log('запись отменена (связь потеряна)');

const afterCancelDoc2 = await req(
  `${GATEWAY}/api/files?ownerType=PATIENT&ownerId=${patient2Card.id}`,
  { headers: doctorAuth },
);
if (afterCancelDoc2.status !== 403) {
  fail(`доступ после отмены: ожидали 403, получили ${afterCancelDoc2.status}`);
}
const afterCancelLink2 = await req(`${GATEWAY}/api/files/${doc2.key}`, {
  headers: doctorAuth,
});
if (afterCancelLink2.status !== 403) {
  fail(`ссылка после отмены: ожидали 403, получили ${afterCancelLink2.status}`);
}
console.log('9.3: после отмены записи врач не имеет доступа (403 и на список, и на ссылку)');

// владелец и ADMIN по-прежнему видят документ
const ownerAuth = { authorization: `Bearer ${await token(patientEmail)}` };
const ownerFiles = await req(`${GATEWAY}/api/files?ownerType=PATIENT&ownerId=${patientCard.id}`, {
  headers: ownerAuth,
});
if (!ownerFiles.ok) fail(`владелец теряет доступ: ${ownerFiles.status}`);
const adminFiles = await req(`${GATEWAY}/api/files?ownerType=PATIENT&ownerId=${patientCard.id}`, {
  headers: adminAuth,
});
if (!adminFiles.ok) fail(`ADMIN теряет доступ: ${adminFiles.status}`);
console.log('9.3: владелец и ADMIN сохраняют доступ после потери связи');

// --- 9.3: чужой врач (без записи) → 403 на загрузку --------------------------
await req(`${GATEWAY}/api/identity/doctors`, {
  method: 'POST',
  headers: adminAuth,
  body: JSON.stringify({
    email: `e9-foreign-${suffix}@e2e.mp`,
    password: 'Password123!',
    firstName: 'Чужой',
    lastName: `Докт${suffix}`,
    specializationId: specId,
    schedule,
  }),
});
{
  const form = new FormData();
  form.set('ownerType', 'PATIENT');
  form.set('ownerId', patientCard.id);
  form.set('kind', 'DOCUMENT');
  form.set('category', 'ANALYSIS');
  form.set('file', new Blob([pdf], { type: 'application/pdf' }), 'x.pdf');
  const res = await fetch(`${GATEWAY}/api/files/upload`, {
    method: 'POST',
    headers: foreignDoctorAuth,
    body: form,
  });
  if (res.status !== 403) fail(`чужой врач загружает: ожидали 403, получили ${res.status}`);
  console.log('9.3: врач без записи не может загрузить документ (403)');
}

console.log('OK: e2e Эпика 9 (9.1/9.2/9.3) прошёл');
