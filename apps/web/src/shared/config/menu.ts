/**
 * Реестр пунктов меню портала (задача 2.1): единая точка для шапки/сайдбара.
 * Фильтрация по ролям — вторичный слой (основная защита — гарды 1.3):
 * пункт недоступной роли не рендерится, но и по прямой ссылке не откроется.
 */

export type MenuRole = 'ADMIN' | 'USER' | 'DOCTOR';

export interface MenuItem {
  href: string;
  label: string;
  /** Роли, которым пункт виден; пусто = все авторизованные. */
  roles: readonly MenuRole[];
}

/** Пункты по разделам (см. design/layout.md и functional-spec §2). */
export const MENU_ITEMS: readonly MenuItem[] = [
  // Администрирование (ADMIN)
  { href: '/admin/doctors', label: 'Врачи', roles: ['ADMIN'] },
  { href: '/admin/specializations', label: 'Специализации', roles: ['ADMIN'] },
  { href: '/admin/patients', label: 'Пациенты', roles: ['ADMIN'] },
  { href: '/admin/schedule', label: 'Управление записями', roles: ['ADMIN'] },
  { href: '/admin/reports', label: 'Отчёты', roles: ['ADMIN'] },

  // Личный кабинет пациента (USER)
  { href: '/cabinet/record', label: 'Запись на приём', roles: ['USER'] },
  { href: '/cabinet/history', label: 'История приёмов', roles: ['USER'] },
  { href: '/cabinet/profile', label: 'Профиль', roles: ['USER'] },

  // Кабинет врача (DOCTOR)
  { href: '/doctor/schedule', label: 'Мои приёмы', roles: ['DOCTOR'] },
  { href: '/doctor/patients', label: 'Пациенты врача', roles: ['DOCTOR'] },
];

/** Пункты, доступные данным ролям (пустой список ролей → ничего). */
export function menuForRoles(roles: readonly MenuRole[]): MenuItem[] {
  if (roles.length === 0) return [];
  return MENU_ITEMS.filter((item) => item.roles.some((role) => roles.includes(role)));
}

/** Пункты для подменю шапки (мобильная навигация) — только своего раздела. */
export function menuForSection(
  roles: readonly MenuRole[],
  section: '/admin' | '/cabinet' | '/doctor',
): MenuItem[] {
  return menuForRoles(roles).filter((item) => item.href.startsWith(section));
}
