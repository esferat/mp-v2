'use client';

import { type ReactNode, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import NextLink from 'next/link';
import { MpAppShell, type MpNavEntry } from 'mp-ui-kit';
import { Box, useMediaQuery } from '@/shared/ui';
import type { MenuItem } from '@/shared/config';
import { UserMenu } from './user-menu';

/** Иконки пунктов меню (visual/layout.html: 🩺 👥 🗓️ 🧩 📊). */
const MENU_ICONS: Record<string, string> = {
  '/admin/doctors': '🩺',
  '/admin/specializations': '🧩',
  '/admin/patients': '👥',
  '/admin/schedule': '🗓️',
  '/admin/reports': '📊',
  '/patient/record': '🗓️',
  '/patient/history': '📜',
  '/patient/documents': '📄',
  '/doctor/schedule': '🩻',
  '/doctor/my-schedule': '📅',
  '/doctor/patients': '📁',
};

/**
 * Логотип «МП» — бирюзовый квадрат с инициалами (visual/_shared.css `.logo`).
 * Клик ведёт на лендинг роли (корень секции, `href`): из любого раздела
 * кабинета логотип возвращает «домой» — на страницу-обзор функционала.
 */
function Logo({ href, onNavigate }: { href: string; onNavigate?: () => void }): React.JSX.Element {
  return (
    <NextLink
      href={href}
      aria-label="Главная страница раздела"
      onClick={onNavigate}
      style={{ display: 'flex', borderRadius: 8, textDecoration: 'none' }}
    >
      <Box
        aria-hidden
        sx={{
          width: 32,
          height: 32,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'primary.main',
          color: 'primary.contrastText',
          fontSize: 13,
          fontWeight: 700,
          flexShrink: 0,
          transition: 'opacity 0.15s ease',
          '&:hover': { opacity: 0.85 },
        }}
      >
        МП
      </Box>
    </NextLink>
  );
}

export interface AppShellProps {
  /** Пункты меню раздела (уже отфильтрованы по ролям на сервере — 2.1). */
  items: ReadonlyArray<MenuItem>;
  /** Заголовок группы меню («Управление», «Кабинет врача»). */
  groupTitle?: string;
  /** Название приложения в шапке. */
  title?: string;
  /** Подзаголовок в шапке (раздел · роль). */
  subtitle?: string;
  /** Логотип в шапке ведёт на лендинг роли (корень секции: /admin|/patient|/doctor). */
  logoHref: string;
  /** Пользователь для меню профиля в шапке: email, роль, «Профиль», аватар. */
  user?: { name: string; subtitle?: string; profileHref?: string; avatarSrc?: string };
  children?: ReactNode;
}

/**
 * Оболочка раздела над MpAppShell (visual/layout.html): шапка 64px
 * (логотип «МП», название, меню пользователя, «Выйти») + боковое меню
 * 240/72px с иконками + контент. Навигация — next/link через роутер;
 * активный пункт — по pathname (в т.ч. /admin/doctors/123 → «Врачи»).
 */
export function AppShell({
  items,
  groupTitle,
  title = 'Медицинский портал',
  subtitle,
  logoHref,
  user,
  children,
}: AppShellProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  // < 960 — мобильный режим: панель выезжает, в шапке гамбургер (макет layout.md)
  const isBelowMd = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const toNavItem = (item: MenuItem) => ({
    id: item.href,
    label: item.label,
    ...(MENU_ICONS[item.href] ? { icon: MENU_ICONS[item.href] } : {}),
  });

  const menu: ReadonlyArray<MpNavEntry> = [
    { id: 'section', ...(groupTitle ? { label: groupTitle } : {}), items: items.map(toNavItem) },
  ];

  // Активный пункт: точное совпадение или вложенный маршрут
  const selectedId = items.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )?.href;

  return (
    <MpAppShell
      menu={menu}
      {...(selectedId ? { selectedId } : {})}
      onSelect={(href) => {
        // Мобильная панель закрывается при переходе (temporary-режим)
        setMobileOpen(false);
        router.push(href);
      }}
      logo={
        <Logo
          href={logoHref}
          // Мобильная панель закрывается при переходе (temporary-режим) —
          // как и для пунктов меню в onSelect
          onNavigate={() => setMobileOpen(false)}
        />
      }
      title={title}
      {...(subtitle ? { subtitle } : {})}
      headerActions={
        user ? (
          <UserMenu
            name={user.name}
            {...(user.subtitle ? { subtitle: user.subtitle } : {})}
            {...(user.profileHref ? { profileHref: user.profileHref } : {})}
            {...(user.avatarSrc ? { avatarSrc: user.avatarSrc } : {})}
          />
        ) : undefined
      }
      drawerVariant={isBelowMd ? 'temporary' : 'permanent'}
      drawerOpen={isBelowMd ? mobileOpen : true}
      onDrawerClose={() => setMobileOpen(false)}
      {...(isBelowMd ? { onMenuClick: () => setMobileOpen(true) } : {})}
    >
      {children}
    </MpAppShell>
  );
}
