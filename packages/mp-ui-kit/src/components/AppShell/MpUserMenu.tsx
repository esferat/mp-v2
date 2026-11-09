import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Typography from '@mui/material/Typography';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { MpAvatar } from '../Avatar/MpAvatar';

/** Пункт меню профиля («Профиль», «Выйти»). */
export interface MpUserMenuItem {
  /** Стабильный id пункта. */
  id: string;
  /** Подпись пункта. */
  label: ReactNode;
  /** Иконка слева (SVG/иконка из `@mui/icons-material`). */
  icon?: ReactNode;
  /** Недоступен (role-guard). */
  disabled?: boolean;
  /** Действие по клику. */
  onClick?: () => void;
}

export interface MpUserMenuProps {
  /** ФИО пользователя (в т.ч. инициалы в аватаре). */
  name: string;
  /** Роль/почта — подпись в меню профиля. */
  subtitle?: ReactNode;
  /** Кастомный аватар (иначе — инициалы из `name` или `src`). */
  avatar?: ReactNode;
  /** Фото аватара (передаётся в `MpAvatar`). */
  avatarSrc?: string;
  /** Пункты меню: «Профиль», «Выйти» (layout.md). */
  items?: ReadonlyArray<MpUserMenuItem>;
  /** Дополнительное содержимое в шапке меню (например, роль). */
  children?: ReactNode;
  className?: string;
}

/** SVG-шеврон вниз у триггера меню. */
function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Меню профиля в шапке (layout.md): аватар с инициалами + ФИО ▾,
 * пункты «Профиль» и «Выйти».
 *
 * @example
 * <MpUserMenu
 *   name="Иванов Иван Иванович"
 *   subtitle="Пациент"
 *   items={[
 *     { id: 'profile', label: 'Профиль', onClick: goProfile },
 *     { id: 'logout', label: 'Выйти', onClick: signOut },
 *   ]}
 * />
 */
export function MpUserMenu({
  name,
  subtitle,
  avatar,
  avatarSrc,
  items,
  children,
  className,
}: MpUserMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = anchorEl !== null;

  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  return (
    <>
      <ButtonBase
        className={className}
        onClick={handleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Меню пользователя: ${name}`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 0.75,
          py: 0.5,
          borderRadius: 1.5,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        {avatar ?? <MpAvatar size="sm" name={name} src={avatarSrc} />}
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, maxWidth: 180, display: { xs: 'none', sm: 'block' } }}
          noWrap
        >
          {name}
        </Typography>
        <Box component="span" sx={{ display: 'flex', color: 'text.secondary' }}>
          <ChevronDownIcon />
        </Box>
      </ButtonBase>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 200 } } }}
      >
        {subtitle || children ? (
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle2" noWrap>
              {name}
            </Typography>
            {subtitle ? (
              <Typography variant="caption" color="text.secondary" noWrap>
                {subtitle}
              </Typography>
            ) : null}
            {children}
          </Box>
        ) : null}
        {(items ?? []).map((item) => (
          <MenuItem
            key={item.id}
            disabled={item.disabled}
            onClick={() => {
              handleClose();
              item.onClick?.();
            }}
          >
            {item.icon ? <ListItemIcon>{item.icon}</ListItemIcon> : null}
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
