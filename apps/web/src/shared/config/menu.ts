/**
 * Реестр пунктов меню портала (задача 2.1): единая точка для шапки/сайдбара
 * и лендингов ролей — после входа каждая роль видит обзор доступного
 * функционала, собранный из этих же пунктов (без дублирования описаний).
 * Фильтрация по ролям — вторичный слой (основная защита — гарды 1.3):
 * пункт недоступной роли не рендерится, но и по прямой ссылке не откроется.
 */

export type MenuRole = 'ADMIN' | 'USER' | 'DOCTOR';

export interface MenuItem {
  href: string;
  label: string;
  /** Роли, которым пункт виден; пусто = все авторизованные. */
  roles: readonly MenuRole[];
  /** Описание раздела — текст карточки на лендинге роли после входа. */
  description: string;
}

/** Пункты по разделам (см. design/layout.md и functional-spec §2). */
export const MENU_ITEMS: readonly MenuItem[] = [
  // Администрирование (ADMIN)
  {
    href: '/admin/doctors',
    label: 'Врачи',
    roles: ['ADMIN'],
    description: 'Создание и правка врачей: ФИО, специализация, расписание, учётная запись',
  },
  {
    href: '/admin/specializations',
    label: 'Специализации',
    roles: ['ADMIN'],
    description: 'Справочник направлений: добавление и удаление свободных позиций',
  },
  {
    href: '/admin/patients',
    label: 'Пациенты',
    roles: ['ADMIN'],
    description: 'Поиск пациентов и просмотр их карточек',
  },
  {
    href: '/admin/schedule',
    label: 'Управление записями',
    roles: ['ADMIN'],
    description: 'Все записи клиники: принять, отклонить, перенести, отменить',
  },
  {
    href: '/admin/reports',
    label: 'Отчёты',
    roles: ['ADMIN'],
    description: 'Статистика приёмов за период',
  },

  // Кабинет пациента (USER). Профиль (/patient/profile) в боковое
  // меню не входит — он доступен из меню пользователя в шапке (10.1);
  // на лендинге роли карточка профиля добавляется отдельно.
  {
    href: '/patient/record',
    label: 'Запись на приём',
    roles: ['USER'],
    description: 'Мастер записи: направление → врач → время → подтверждение',
  },
  {
    href: '/patient/history',
    label: 'История приёмов',
    roles: ['USER'],
    description: 'Все записи с фильтрами по статусу и специализации',
  },
  {
    href: '/patient/documents',
    label: 'Мои документы',
    roles: ['USER'],
    description: 'Сканы анализов и выписок: загрузка, скачивание, удаление',
  },

  // Кабинет врача (DOCTOR)
  {
    href: '/doctor/schedule',
    label: 'Мои приёмы',
    roles: ['DOCTOR'],
    description: 'Список приёмов с фильтрами и внесением результата приёма',
  },
  {
    href: '/doctor/my-schedule',
    label: 'Моё расписание',
    roles: ['DOCTOR'],
    description: 'Самостоятельная правка расписания приёма своей карточки',
  },
  {
    href: '/doctor/patients',
    label: 'Пациенты врача',
    roles: ['DOCTOR'],
    description: 'Пациенты с приёмами: карточка, история приёмов и документы',
  },
];

/** Пункты, доступные данным ролям (пустой список ролей → ничего). */
export function menuForRoles(roles: readonly MenuRole[]): MenuItem[] {
  if (roles.length === 0) return [];
  return MENU_ITEMS.filter((item) => item.roles.some((role) => roles.includes(role)));
}

/** Пункты для подменю шапки (мобильная навигация) — только своего раздела. */
export function menuForSection(
  roles: readonly MenuRole[],
  section: '/admin' | '/patient' | '/doctor',
): MenuItem[] {
  return menuForRoles(roles).filter((item) => item.href.startsWith(section));
}
