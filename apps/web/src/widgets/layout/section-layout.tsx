import type { ReactNode } from 'react';
import { createServerApi } from '@/shared/api';
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
 * Фото аватара в шапке (3.4/4.3): пациент — карточка patient-service,
 * врач — карточка catalog; админ — без аватара (инициалы, решение этапа).
 * Приоритет ролей — как в homeRedirectFor (ADMIN > DOCTOR > USER).
 * Ошибка загрузки не должна ломать layout → undefined (инициалы).
 */
async function loadAvatarSrc(
  userId: string,
  roles: readonly MenuRole[],
): Promise<string | undefined> {
  if (roles.includes('ADMIN')) return undefined;
  try {
    const api = await createServerApi();
    if (roles.includes('DOCTOR')) {
      const doctor = await api.catalog.getMyDoctor();
      return doctor.photoUrl;
    }
    if (roles.includes('USER')) {
      const patient = await api.patient.getByUser(userId);
      return patient.photoUrl;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

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
  const avatarSrc = session?.user.id ? await loadAvatarSrc(session.user.id, roles) : undefined;

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
              ...(avatarSrc ? { avatarSrc } : {}),
            }
          : undefined
      }
    >
      {children}
    </AppShell>
  );
}
