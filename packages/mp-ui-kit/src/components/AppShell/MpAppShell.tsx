import Box from '@mui/material/Box';
import { type ReactNode, useState } from 'react';
import { MpAppBar } from './MpAppBar';
import { MpNavDrawer, type MpNavEntry } from './MpNavDrawer';
import { MpPageHeader } from './MpPageHeader';

export interface MpAppShellProps {
  /**
   * Пункты бокового меню (передаются через пропсы — для ADMIN/USER/DOCTOR
   * разные массивы; поддерживаются секции с заголовками — layout.md).
   */
  menu: ReadonlyArray<MpNavEntry>;
  /** id выбранного пункта меню. */
  selectedId?: string;
  /** Выбор пункта меню (обычно — переход по роуту). */
  onSelect?: (id: string) => void;

  /** Логотип в шапке (картинка/символ бренда). */
  logo?: ReactNode;
  /** Название приложения в шапке. */
  title?: ReactNode;
  /** Подзаголовок рядом с названием (например, имя клиники). */
  subtitle?: ReactNode;
  /** Правая часть шапки: уведомления, меню пользователя, выход. */
  headerActions?: ReactNode;

  /** Заголовок страницы. */
  pageTitle?: ReactNode;
  /** Подзаголовок страницы. */
  pageSubtitle?: ReactNode;
  /** Кнопки действий страницы (справа от заголовка). */
  pageActions?: ReactNode;

  /** Свёрнутое меню (72px, иконки + тултипы) — управляемое состояние. */
  mini?: boolean;
  /** Свёрнутое меню по умолчанию (неуправляемый режим). @default false */
  defaultMini?: boolean;
  /** Изменение состояния меню (кнопка внизу панели). */
  onMiniChange?: (mini: boolean) => void;

  /** Режим боковой панели. @default 'permanent' */
  drawerVariant?: 'permanent' | 'temporary' | 'persistent';
  /** Открыта временная/выдвижная панель (mobile). @default true */
  drawerOpen?: boolean;
  /** Закрыть панель (temporary: клик по оверлею, Escape). */
  onDrawerClose?: () => void;
  /** Кнопка-гамбургер в шапке (для мобильного меню). */
  onMenuClick?: () => void;

  /** Контент страницы (router-outlet). */
  children?: ReactNode;
}

/**
 * Единая оболочка приложения по макету design/layout.md:
 * шапка 64px (логотип, название, действия) + боковое меню 240/72px
 * (с кнопкой свернуть/развернуть внизу) + заголовок страницы 72px + контент.
 *
 * @example
 * <MpAppShell
 *   menu={adminMenu}
 *   selectedId="schedule"
 *   onSelect={navigate}
 *   logo={<img src="/logo.svg" alt="" width={28} height={28} />}
 *   title="MP Admin-Panel"
 *   pageTitle="Управление записями"
 *   pageActions={<MpButton variant="contained">Новая запись</MpButton>}
 * >
 *   <TablePage />
 * </MpAppShell>
 */
export function MpAppShell({
  menu,
  selectedId,
  onSelect,
  logo,
  title,
  subtitle,
  headerActions,
  pageTitle,
  pageSubtitle,
  pageActions,
  mini,
  defaultMini = false,
  onMiniChange,
  drawerVariant = 'permanent',
  drawerOpen = true,
  onDrawerClose,
  onMenuClick,
  children,
}: MpAppShellProps) {
  const [internalMini, setInternalMini] = useState(defaultMini);
  const collapsed = mini ?? internalMini;

  const toggleCollapse = () => {
    const next = !collapsed;
    if (mini === undefined) setInternalMini(next);
    onMiniChange?.(next);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        // Каркас страницы — 1200px по центру (решение по вёрстке: рамка
        // включает сайдбар, контент = 1200 − сайдбар). Шапка и меню живут
        // ВНУТРИ рамки (макет .frame): sticky/в потоке, не fixed на viewport.
        maxWidth: '1200px',
        mx: 'auto',
      }}
    >
      {/* Шапка sticky в потоке рамки — ширину задаёт каркас, не окно */}
      <MpAppBar
        position="sticky"
        sx={{ flexShrink: 0 }}
        logo={logo}
        title={title}
        subtitle={subtitle}
        actions={headerActions}
        onMenuClick={onMenuClick}
      />
      {/* Строка растягивается на всю высоту каркаса — сайдбар идёт до низа
          страницы (при коротком контенте — до низа окна) */}
      <Box sx={{ display: 'flex', flex: 1, flexShrink: 0 }}>
        <MpNavDrawer
          items={menu}
          selectedId={selectedId}
          onSelect={onSelect}
          mini={collapsed}
          variant={drawerVariant}
          open={drawerOpen}
          onClose={onDrawerClose}
          onToggleCollapse={toggleCollapse}
        />
        <Box
          component="main"
          sx={{
            // Сайдбар — в потоке flex-строки, отступов под фиксированную
            // шапку больше не нужно (sticky занимает место в потоке)
            flex: 1,
            minWidth: 0,
            px: { xs: 2, md: 3 },
            pb: 3,
          }}
        >
          {pageTitle ? (
            <MpPageHeader title={pageTitle} subtitle={pageSubtitle} actions={pageActions} />
          ) : null}
          {children}
        </Box>
      </Box>
    </Box>
  );
}
