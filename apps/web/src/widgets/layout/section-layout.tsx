import type { ReactNode } from 'react';
import { auth } from '@/shared/config/auth';
import { menuForSection, type MenuRole } from '@/shared/config';
import { AppShell } from './app-shell';

/** Группа меню по разделу (visual/layout.html: «Управление» / кабинеты). */
const GROUP_TITLES = {
  '/admin': 'Управление',
  '/cabinet': 'Личный кабинет',
  '/doctor': 'Кабинет врача',
} as const;

/** Подзаголовок шапки по разделу (visual/layout.html: «MP Admin-Panel · ADMIN»). */
const SECTION_SUBTITLES = {
  '/admin': 'MP Admin-Panel',
  '/cabinet': 'Личный кабинет пациента',
  '/doctor': 'Кабинет врача',
} as const;

/** «Профиль» в меню пользователя — роль-specific маршрут (profile.md: 10.1). */
const PROFILE_HREFS = {
  '/admin': '/admin/profile',
  '/cabinet': '/cabinet/profile',
  '/doctor': '/doctor/profile',
} as const;

/**
 * Каркас раздела (2.1) — MpAppShell по макету visual/layout.html: шапка 64px
 * (логотип, название, меню пользователя, «Выйти») + боковое меню с иконками
 * + контент. Route group ((admin)/(cabinet)/(doctor)) оборачивает страницы
 * этим layout'ом. Пункты меню фильтруются по ролям сессии на сервере
 * (пункт чужой роли не попадает в HTML — 2.1). Профиль — только в меню
 * пользователя (шапка), в боковом меню его нет.
 */
export async function SectionLayout({
  section,
  description,
  children,
}: {
  section: '/admin' | '/cabinet' | '/doctor';
  title?: string;
  description?: string;
  children: ReactNode;
}): Promise<React.JSX.Element> {
  const session = await auth();
  const roles = (session?.user.roles ?? []) as MenuRole[];
  const items = menuForSection(roles, section);

  const role = roles[0];
  const email = session?.user.email ?? '';

  return (
    <AppShell
      items={items}
      groupTitle={GROUP_TITLES[section]}
      subtitle={[SECTION_SUBTITLES[section], role].filter(Boolean).join(' · ') || description}
      user={
        email
          ? {
              name: email,
              ...(role ? { subtitle: role } : {}),
              profileHref: PROFILE_HREFS[section],
            }
          : undefined
      }
    >
      {children}
    </AppShell>
  );
}
