import type { Role } from './claims';

/**
 * Политика маршрута gateway (1.2): кто может вызывать.
 * `roles: null` — публичный маршрут (только rate-limit, токен не нужен).
 *
 * NB: это ПЕРВЫЙ рубеж (architecture.md §7: gateway → сервис → service-guard).
 * Таблица уточняется задачами эпиков 2–5; сервисы обязаны проверять права
 * и при прямом обращении (защита в глубину).
 */
export interface RoutePolicy {
  /** HTTP-методы; пусто = любые. */
  methods?: string[];
  /** Префикс пути (после pathname). */
  path: string;
  /** null = публичный; [] = любой авторизованный; иначе — требуемые роли (OR). */
  roles: Role[] | null;
  comment?: string;
}

/** Реестр политик: порядок не важен — ищется самое длинное совпадение префикса. */
export const ROUTE_POLICIES: RoutePolicy[] = [
  // Health-эндпоинты контейнера — всегда публичны (healthcheck compose)
  { path: '/healthz', roles: null, comment: 'liveness контейнера' },
  { path: '/readyz', roles: null, comment: 'readiness контейнера' },
  // Метрики процесса — scrape Prometheus без токена (0.9)
  { path: '/metrics', roles: null, comment: 'scrape Prometheus' },

  // Регистрация/вход — до входа в систему, поэтому публичные (жёсткий rate-limit)
  { path: '/api/auth', roles: null, comment: 'регистрация/служебные — до входа' },
  {
    methods: ['POST'],
    path: '/api/identity/register',
    roles: null,
    comment: 'сага регистрации 1.4 — гость ещё не имеет токена',
  },
  {
    methods: ['POST'],
    path: '/api/identity/doctors',
    roles: ['ADMIN'],
    comment: 'сага врача с учётной записью DOCTOR (9.1) — только админ',
  },
  {
    methods: ['GET', 'PATCH'],
    path: '/api/identity/me',
    roles: ['ADMIN', 'USER', 'DOCTOR'],
    comment: '10.1: профиль и правка СВОИХ данных (sub из токена)',
  },

  // Каталог: админский CRUD; чтение справочника — для записи (эпики 3, 5)
  { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], path: '/api/catalog/doctors', roles: ['ADMIN'] },
  {
    methods: ['PUT'],
    path: '/api/catalog/doctors/me/schedule',
    roles: ['DOCTOR'],
    comment: '10.4: врач правит расписание своей карточки (sub из токена)',
  },
  {
    methods: ['GET'],
    path: '/api/catalog/doctors/me',
    roles: ['DOCTOR'],
    comment: '10.4: карточка своего врача по токену (форма расписания)',
  },
  {
    methods: ['GET'],
    path: '/api/catalog/doctors',
    roles: ['ADMIN'],
    comment: '3.1 AC: USER → 403',
  },
  {
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    path: '/api/catalog/specializations',
    roles: ['ADMIN'],
  },
  {
    path: '/api/catalog/specializations',
    roles: ['ADMIN', 'USER', 'DOCTOR'],
    comment: 'справочник для записи',
  },
  { path: '/api/catalog', roles: ['ADMIN'], comment: 'остальное в каталоге — админское' },

  // Пациенты: список — админ/врач; карточка — владелец/админ/врач (проверяет сервис).
  // NB: POST /api/patient (создание из саги) идёт identity → patient НАПРЯМУЮ,
  // не через gateway — наружу создание не выдаём (1.4).
  { methods: ['POST'], path: '/api/patient', roles: ['ADMIN'] },
  // Внутренний маршрут (5.3/9.3): сервисные вызовы scheduling идут напрямую
  // в сеть контейнеров; через gateway — только админ (без сервисов ролей нет)
  { methods: ['GET'], path: '/api/patient/internal', roles: ['ADMIN'] },
  { methods: ['GET'], path: '/api/patients', roles: ['ADMIN', 'DOCTOR'] },
  { path: '/api/patients', roles: ['ADMIN'] },
  { path: '/api/patient', roles: ['ADMIN', 'USER', 'DOCTOR'] },

  // Записи: бронь — пациент/админ (5.3: ADMIN указывает patientId явно);
  // статусы — админ/врач; результат приёма — врач/админ
  { methods: ['POST'], path: '/api/scheduling/appointments', roles: ['USER', 'DOCTOR', 'ADMIN'] },
  { methods: ['PUT', 'PATCH'], path: '/api/scheduling/appointments', roles: ['ADMIN', 'DOCTOR'] },
  // 9.1 AC: расписание врача — только DOCTOR/ADMIN; 403 обязан выдать И gateway,
  // И сервис (защита в глубину). Путь длиннее общего — выигрывает по префиксу.
  {
    methods: ['GET'],
    path: '/api/scheduling/appointments/doctor',
    roles: ['DOCTOR', 'ADMIN'],
    comment: '9.1 AC: USER → 403 на gateway',
  },
  // Своя история (5.5): patientId берётся из токена в сервисе, поэтому роль не режем
  {
    methods: ['GET'],
    path: '/api/scheduling/appointments/me',
    roles: ['ADMIN', 'USER', 'DOCTOR'],
    comment: '5.5: только своя история',
  },
  // Список ВСЕХ записей (5.4) — только админ: сервис прав не проверяет, значит
  // рубеж обязан быть на шлюзе (1.2 AC: «чужая роль → 403»). Без этого любой
  // USER читал бы чужие записи через прямой вызов gateway.
  {
    methods: ['GET'],
    path: '/api/scheduling/appointments',
    roles: ['ADMIN'],
    comment: '5.4/1.2: список всех записей — админ',
  },
  { path: '/api/scheduling/appointments', roles: ['ADMIN', 'USER', 'DOCTOR'] },
  {
    methods: ['PUT'],
    path: '/api/scheduling/appointments/:id/reschedule',
    roles: ['ADMIN'],
    comment: '10.3: перенос записи — только админ (и на gateway, и в сервисе)',
  },
  { path: '/api/scheduling', roles: ['ADMIN', 'USER', 'DOCTOR'], comment: 'слоты читают все роли' },

  // Файлы: права на объект проверяет file-service (владелец/админ/врач)
  { path: '/api/files', roles: ['ADMIN', 'USER', 'DOCTOR'] },

  // Отчёты — только админ
  { path: '/api/reports', roles: ['ADMIN'] },

  // Уведомления — служебные (почерпываются сервисами)
  { path: '/api/notifications', roles: ['ADMIN'] },
];

/** Кэш regex для путей с параметрами (один паттерн — один regex). */
const pathPatternCache = new Map<string, RegExp>();

/**
 * Совпадение пути политики: обычные пути — префикс; пути с `:param`
 * (один сегмент) — по сегментам (10.3: `/appointments/:id/reschedule`
 * не должен перехватывать `/appointments/:id/status`).
 */
function matchesPath(pattern: string, pathname: string): boolean {
  if (!pattern.includes(':')) return pathname.startsWith(pattern);

  let regex = pathPatternCache.get(pattern);
  if (!regex) {
    const source = pattern
      .split('/')
      .map((segment) =>
        segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      )
      .join('/');
    regex = new RegExp(`^${source}`);
    pathPatternCache.set(pattern, regex);
  }
  return regex.test(pathname);
}

/**
 * Политика для запроса: самое длинное совпадение префикса выигрывает.
 * Возвращает undefined, если маршрута нет в реестре (любой авторизованный).
 */
export function findPolicy(
  method: string,
  pathname: string,
  policies: RoutePolicy[] = ROUTE_POLICIES,
): RoutePolicy | undefined {
  let best: RoutePolicy | undefined;
  for (const policy of policies) {
    if (!matchesPath(policy.path, pathname)) continue;
    if (policy.methods && !policy.methods.includes(method.toUpperCase())) continue;
    if (!best || policy.path.length > best.path.length) best = policy;
  }
  return best;
}

/** Есть ли у роли доступ к политике (null — публичный, [] — любая авторизованная). */
export function allowsRoles(policy: RoutePolicy | undefined, roles: Role[]): boolean {
  if (!policy || policy.roles === null) return true;
  if (policy.roles.length === 0) return true;
  return roles.some((role) => policy.roles?.includes(role));
}
