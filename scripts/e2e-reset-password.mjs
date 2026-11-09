// E2E: восстановление пароля через Keycloak + Mailpit (AC 1.5 / TD-08).
//
// Проверяет полный цикл «запрос → письмо → смена → вход новым паролем» И главный
// AC 1.5 «старые сессии невалидны после смены»: до/после сброса сверяем access-токен,
// выданный ДО смены пароля, через userinfo.
//
// Восстановление: после теста пароль seed-пользователя возвращается через Admin API,
// чтобы dev-аккаунт снова работал (скрипт идемпотентен к окружению).
//
// Запуск: node scripts/e2e-reset-password.mjs (стек поднят)
import { setTimeout as sleep } from 'node:timers/promises';

const KC = 'http://localhost:8180';
const REALM = 'medical-portal';
const MAILPIT = 'http://localhost:8025';
const CLIENT = 'next-web';
const REDIRECT = 'http://localhost:8080/api/auth/callback/keycloak';
const USER_EMAIL = 'patient@test.mp';
const ORIGINAL_PASSWORD = 'Password123!';
const NEW_PASSWORD = `NewPass-${Date.now()}!`;
const PKCE_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

function fail(message) {
  console.error('FAIL:', message);
  process.exit(1);
}

function ok(message) {
  console.log('OK:', message);
}

/** Простой кук-джар одного «браузера» (сброс — браузерный flow Keycloak). */
function makeJar() {
  const jar = new Map();
  return {
    header: () => [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
    absorb(res) {
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const [pair] = line.split(';');
        const eq = pair.indexOf('=');
        if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
      }
    },
  };
}

/** JSON-строка из встроенного в HTML kcContext (значения с экранированием «\/»). */
function fromKcJson(html, key) {
  const raw = (html.match(new RegExp(`"${key}":\\s*"([^"]+)"`)) || [])[1];
  return raw ? JSON.parse(`"${raw}"`) : undefined;
}

/** Переходы внутри Keycloak (action-token → страница) с накоплением кук. */
async function followWithin(startUrl, jar) {
  let url = startUrl;
  for (let hop = 0; hop < 6; hop += 1) {
    const res = await fetch(url, { redirect: 'manual', headers: { cookie: jar.header() } });
    jar.absorb(res);
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url).toString();
      continue;
    }
    return { status: res.status, url, html: await res.text() };
  }
  throw new Error('слишком много редиректов при переходе по ссылке из письма');
}

async function tokenFor(password) {
  // Как в других e2e-скриптах: конфиденциальный сервисный клиент svc-e2e
  // (next-web — публичный с PKCE, для password-grant не подходит).
  const res = await fetch(`${KC}/realms/${REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'svc-e2e',
      client_secret: 'dev-e2e-secret',
      username: USER_EMAIL,
      password,
      // без openid userinfo отдаёт 403 — юзаем полный набор как в OIDC-флоу
      scope: 'openid profile email',
    }),
  });
  return { status: res.status, body: await res.json() };
}

/**
 * Жива ли СЕССИЯ токена (AC 1.5): introspection — авторитетная проверка,
 * т.к. она учитывает завершение пользовательской сессии в Keycloak
 * (подпись/срок годности токена при этом остаются валидными).
 */
async function sessionAlive(accessToken) {
  const res = await fetch(`${KC}/realms/${REALM}/protocol/openid-connect/token/introspect`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      token: accessToken,
      client_id: 'svc-e2e',
      client_secret: 'dev-e2e-secret',
    }),
  });
  const body = await res.json();
  return { status: res.status, active: body.active === true, sid: body.sid };
}

// --- 0) Admin API: id пользователя (нужен для восстановления пароля) --------------
const adminTok = await (
  await fetch(`${KC}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: 'admin',
      password: 'admin',
    }),
  })
).json();
if (!adminTok.access_token) fail('нет admin-токена');
const adminHeaders = { authorization: `Bearer ${adminTok.access_token}` };

const found = await (
  await fetch(`${KC}/admin/realms/${REALM}/users?email=${encodeURIComponent(USER_EMAIL)}`, {
    headers: adminHeaders,
  })
).json();
const user = found[0];
if (!user)
  fail(`пользователь ${USER_EMAIL} не найден (нужен seed: node scripts/seed-test-users.mjs)`);
ok(`пользователь найден: ${user.username}`);

async function restoreOriginalPassword() {
  const res = await fetch(`${KC}/admin/realms/${REALM}/users/${user.id}/reset-password`, {
    method: 'PUT',
    headers: { ...adminHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'password', value: ORIGINAL_PASSWORD, temporary: false }),
  });
  if (!res.ok) fail(`не удалось вернуть исходный пароль: HTTP ${res.status}`);
  const check = await tokenFor(ORIGINAL_PASSWORD);
  if (check.status !== 200) fail(`исходный пароль не восстановился (HTTP ${check.status})`);
  ok('исходный пароль восстановлен, вход работает');
}

// --- 1) Токен ДО сброса («старая сессия») -----------------------------------------
const before = await tokenFor(ORIGINAL_PASSWORD);
if (before.status !== 200) fail(`нет токена до сброса (HTTP ${before.status})`);
const oldToken = before.body.access_token;
const aliveBefore = await sessionAlive(oldToken);
if (!aliveBefore.active) fail('токен до сброса не активен — сверните seed');
ok(`токен до сброса активен (introspect active=true, sid=${aliveBefore.sid})`);

const jar = makeJar();

try {
  // --- 2) Запрос сброса: страница выбора пользователя → письмо --------------------
  const authUrl =
    `${KC}/realms/${REALM}/protocol/openid-connect/auth?client_id=${CLIENT}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code&scope=openid` +
    `&code_challenge=${PKCE_CHALLENGE}&code_challenge_method=S256&state=e2e-reset`;

  const authRes = await fetch(authUrl, { redirect: 'manual' });
  jar.absorb(authRes);
  const loginHtml = await authRes.text();
  const resetHref = fromKcJson(loginHtml, 'loginResetCredentialsUrl');
  if (!resetHref) fail('нет loginResetCredentialsUrl на странице входа');

  const pageRes = await fetch(new URL(resetHref, KC), {
    redirect: 'manual',
    headers: { cookie: jar.header() },
  });
  jar.absorb(pageRes);
  const pageHtml = await pageRes.text();
  const chooseAction = fromKcJson(pageHtml, 'loginAction');
  if (!chooseAction) fail('нет loginAction на странице выбора пользователя');

  const submitRes = await fetch(chooseAction, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: jar.header() },
    body: new URLSearchParams({ username: USER_EMAIL }),
  });
  jar.absorb(submitRes);
  console.log('  запрос сброса:', submitRes.status, submitRes.headers.get('location') ?? '');

  // --- 3) Письмо в Mailpit ---------------------------------------------------------
  const startedAt = Date.now();
  let messageId = null;
  for (let i = 0; i < 30 && !messageId; i += 1) {
    await sleep(500);
    const list = await (await fetch(`${MAILPIT}/api/v1/messages?limit=20`)).json();
    // API Mailpit: To = [{ Name, Address }]; берём свежее нашего запуска
    messageId =
      (list.messages ?? []).find(
        (m) =>
          Date.parse(m.Created ?? '') >= startedAt - 5_000 &&
          (m.To ?? []).some((to) => to.Address === USER_EMAIL),
      )?.ID ?? null;
  }
  if (!messageId) {
    const all = await (await fetch(`${MAILPIT}/api/v1/messages?limit=10`)).json();
    console.log('  сообщений в Mailpit:', all.total);
    (all.messages ?? [])
      .slice(0, 3)
      .forEach((m) => console.log('   -', JSON.stringify(m).slice(0, 200)));
    fail('письмо о сбросе не пришло в Mailpit (SMTP → mailpit в манифесте реалма)');
  }
  ok('письмо получено из Mailpit');

  const message = await (await fetch(`${MAILPIT}/api/v1/message/${messageId}`)).json();
  const html = message.HTML ?? message.Text ?? '';
  const link = (html.match(/href="([^"]+)"/) || [])[1];
  if (!link) fail('в письме нет ссылки для сброса');
  const resetLink = link.replace(/&amp;/g, '&');
  console.log('  ссылка из письма:', resetLink.slice(0, 120) + '…');

  // --- 4) Установка нового пароля (форма login-update-password) --------------------
  const formRes = await followWithin(resetLink, jar);
  const formHtml = formRes.html;
  // Важно: FTL после JSON-литерала явно делает kcContext.pageId = "<page>.ftl" —
  // именно это значение видит React (первое вхождение в JSON — "login" без .ftl).
  const pageId = (formHtml.match(/kcContext\.pageId\s*=\s*"([^"]+)"/) || [])[1];
  const updateAction = fromKcJson(formHtml, 'loginAction');
  console.log(
    '  страница смены:',
    pageId,
    '| статус:',
    formRes.status,
    '| url:',
    formRes.url.slice(0, 110),
  );
  if (pageId !== 'login-update-password.ftl') {
    fail(`неожиданный pageId страницы смены: ${pageId}`);
  }
  if (!updateAction) fail('нет loginAction на странице смены пароля');

  const changeRes = await fetch(updateAction, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: jar.header() },
    // logout-sessions: AC 1.5 — так же, как принудительно добавляет тема
    // (packages/keycloak-theme/src/login/template.tsx); юнит-тест темы проверяет
    // само добавление поля, здесь проверяется, что Keycloak его выполняет.
    body: new URLSearchParams({
      'password-new': NEW_PASSWORD,
      'password-confirm': NEW_PASSWORD,
      'logout-sessions': 'on',
    }),
  });
  jar.absorb(changeRes);
  console.log('  смена пароля:', changeRes.status, changeRes.headers.get('location') ?? '');
  if (changeRes.status >= 400) {
    const text = await changeRes.text();
    console.log('  тело ответа:', text.replace(/\s+/g, ' ').slice(0, 400));
    fail('смена пароля не прошла');
  }

  // --- 5) AC 1.5: старые сессии -----------------------------------------------------
  const aliveAfter = await sessionAlive(oldToken);
  console.log(
    '  introspect старым токеном после смены:',
    aliveAfter.status,
    '| active:',
    aliveAfter.active,
  );

  // --- 6) Вход новым паролем --------------------------------------------------------
  const newLogin = await tokenFor(NEW_PASSWORD);
  if (newLogin.status !== 200) fail(`вход новым паролем не работает (HTTP ${newLogin.status})`);
  ok('вход новым паролем работает');

  const oldLogin = await tokenFor(ORIGINAL_PASSWORD);
  if (oldLogin.status === 200) fail('старый пароль всё ещё принимается');
  ok('старый пароль отклонён');

  // Итог по AC 1.5 «старые сессии невалидны»
  if (aliveAfter.active) {
    console.log(
      'RESULT: СЕССИИ_НЕ_ЗАКОНЧЕНЫ — Keycloak не завершает активные сессии после сброса (AC 1.5 не выполнен)',
    );
    process.exitCode = 2;
  } else {
    ok(`старая сессия завершена (introspect active=false) — AC 1.5 выполнен`);
  }
} finally {
  // Всегда возвращаем seed-пароль, даже при падении теста
  try {
    await restoreOriginalPassword();
  } catch (error) {
    console.error('восстановление пароля не удалось:', error);
  }
}
