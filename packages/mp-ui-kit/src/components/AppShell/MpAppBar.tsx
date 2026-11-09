import AppBar, { type AppBarProps } from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { forwardRef, type ReactNode } from 'react';

/** Простой SVG-гамбургер: не тянет `@mui/icons-material` как peer-зависимость. */
function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M3 6h18M3 12h18M3 18h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface MpAppBarProps extends Omit<AppBarProps, 'title'> {
  /** Название приложения / бренда («MP Admin-Panel»). */
  title?: ReactNode;
  /** Кнопка-гамбургер слева (видна при `onMenuClick`). */
  onMenuClick?: () => void;
  /** Логотип слева (картинка/символ бренда) — рядом с названием. */
  logo?: ReactNode;
  /** Подзаголовок рядом с названием (необязательно). */
  subtitle?: ReactNode;
  /** Правая часть шапки: уведомления, меню пользователя, выход. */
  actions?: ReactNode;
}

/**
 * Шапка приложения (64px, elevation 0, разделитель снизу — из темы).
 *
 * @example
 * <MpAppBar
 *   title="MP Admin-Panel"
 *   onMenuClick={() => setOpen(true)}
 *   actions={<IconButton>…</IconButton>}
 * />
 */
export const MpAppBar = forwardRef<HTMLDivElement, MpAppBarProps>(function MpAppBar(
  {
    title,
    subtitle,
    logo,
    onMenuClick,
    actions,
    position = 'fixed',
    color = 'default',
    sx,
    ...props
  },
  ref,
) {
  return (
    <AppBar
      ref={ref}
      position={position}
      color={color}
      // Шапка должна быть поверх постоянного Drawer (в макете header на всю ширину сверху).
      sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, ...sx }}
      {...props}
    >
      <Toolbar disableGutters sx={{ px: { xs: 1.5, sm: 2 }, gap: 1.5 }}>
        {onMenuClick ? (
          <IconButton
            color="inherit"
            aria-label="Открыть меню"
            edge="start"
            onClick={onMenuClick}
            sx={{ mr: 0.5 }}
          >
            <MenuIcon />
          </IconButton>
        ) : null}
        {logo ? (
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{logo}</Box>
        ) : null}
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 0, fontWeight: 700, letterSpacing: '-0.01em' }}
        >
          {title}
        </Typography>
        {subtitle ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            {subtitle}
          </Typography>
        ) : null}
        <Box sx={{ flexGrow: 1 }} />
        {actions}
      </Toolbar>
    </AppBar>
  );
});
