import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer, { type DrawerProps } from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import type { ReactNode } from 'react';
import { mpTokens } from '../../theme/tokens';

/** SVG-шеврон: направление задаётся через `collapsed` (без зависимости от icons-material). */
function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      focusable="false"
      style={{ transform: collapsed ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }}
    >
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface MpNavItem {
  /** Стабильный id пункта (маршрут, ключ). */
  id: string;
  /** Подпись пункта. */
  label: ReactNode;
  /** Иконка слева (SVG/иконка из `@mui/icons-material`). */
  icon?: ReactNode;
  /** Недоступен (нет прав/скрыт). */
  disabled?: boolean;
  /** Действие по клику (обычно — роутер). */
  onClick?: () => void;
}

export interface MpNavDrawerProps {
  /** Пункты меню (для ADMIN/USER — разные массивы). */
  items: ReadonlyArray<MpNavItem>;
  /** id выбранного пункта. */
  selectedId?: string;
  /** Постоянная боковая панель (desktop) или временная (mobile). @default 'permanent' */
  variant?: 'permanent' | 'temporary' | 'persistent';
  /** Открыта (для temporary/persistent). @default true */
  open?: boolean;
  /** Закрыть (temporary: клик по оверлею, Escape). */
  onClose?: DrawerProps['onClose'];
  /**
   * Свёрнутый режим (72px, только иконки + тултипы) — по макету layout.md
   * («свёрнутое меню — иконки + тултип»).
   */
  mini?: boolean;
  /** Вызов при выборе пункта (удобно для активного состояния). */
  onSelect?: (id: string) => void;
  /** Высота зафиксированной шапки (чтобы контент начинался под ней). @default 64 */
  headerHeight?: number;
  /** Ширина развёрнутой панели. @default 240 */
  width?: number;
  /**
   * Кнопка свернуть/развернуть внизу панели (см. mini). Без обработчика
   * кнопка не показывается — логику состояния держит владелец.
   */
  onToggleCollapse?: () => void;
}

/**
 * Боковое меню оболочки (layout.md): ширина 240px, свёрнутый режим — 72px.
 * Под постоянную шапку подставляет `Toolbar`-отступ.
 *
 * @example
 * <MpNavDrawer
 *   items={adminMenu}
 *   selectedId="schedule"
 *   variant="persistent"
 *   open={open}
 *   onClose={close}
 * />
 */
export function MpNavDrawer({
  items,
  selectedId,
  variant = 'permanent',
  open = true,
  onClose,
  mini = false,
  onSelect,
  headerHeight = mpTokens.layout.header,
  width = mpTokens.layout.sidebar,
  onToggleCollapse,
}: MpNavDrawerProps) {
  const effectiveWidth = mini ? mpTokens.layout.sidebarMini : width;

  return (
    <Drawer
      variant={variant}
      open={open}
      onClose={onClose}
      sx={{
        width: variant === 'permanent' || open ? effectiveWidth : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: effectiveWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
          overflowX: 'hidden',
        },
      }}
    >
      {/* Отступ под фиксированной шапкой */}
      <Toolbar disableGutters sx={{ minHeight: headerHeight, px: 1.5 }} />
      <List sx={{ px: 1, py: 1, gap: 0.5, display: 'flex', flexDirection: 'column' }}>
        {items.map((item) => {
          const selected = item.id === selectedId;

          const button = (
            <ListItemButton
              key={item.id}
              selected={selected}
              disabled={item.disabled}
              onClick={() => {
                onSelect?.(item.id);
                item.onClick?.();
              }}
              aria-current={selected ? 'page' : undefined}
              sx={{ justifyContent: mini ? 'center' : 'flex-start', px: mini ? 0 : 1.5 }}
            >
              {item.icon ? (
                <ListItemIcon
                  sx={{ minWidth: mini ? 0 : 36, mr: mini ? 0 : 1.5, justifyContent: 'center' }}
                >
                  {item.icon}
                </ListItemIcon>
              ) : null}
              {mini ? null : (
                <ListItemText primary={item.label} slotProps={{ primary: { noWrap: true } }} />
              )}
            </ListItemButton>
          );

          return mini ? (
            <Tooltip key={item.id} title={String(item.label)} placement="right">
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
      </List>
      <Box sx={{ flexGrow: 1 }} />
      {onToggleCollapse ? (
        <>
          <Divider />
          <List sx={{ px: 1, py: 1 }}>
            {(() => {
              const button = (
                <ListItemButton
                  onClick={onToggleCollapse}
                  aria-label={mini ? 'Развернуть меню' : 'Свернуть меню'}
                  sx={{ justifyContent: mini ? 'center' : 'flex-start', px: mini ? 0 : 1.5 }}
                >
                  <ListItemIcon
                    sx={{ minWidth: mini ? 0 : 36, mr: mini ? 0 : 1.5, justifyContent: 'center' }}
                  >
                    <CollapseIcon collapsed={mini} />
                  </ListItemIcon>
                  {mini ? null : (
                    <ListItemText
                      primary={mini ? 'Развернуть' : 'Свернуть'}
                      slotProps={{ primary: { noWrap: true } }}
                    />
                  )}
                </ListItemButton>
              );

              return mini ? (
                <Tooltip title="Развернуть меню" placement="right">
                  {button}
                </Tooltip>
              ) : (
                button
              );
            })()}
          </List>
        </>
      ) : null}
    </Drawer>
  );
}
