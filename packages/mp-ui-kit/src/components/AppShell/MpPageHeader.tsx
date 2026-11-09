import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { mpTokens } from '../../theme/tokens';

export interface MpPageHeaderProps {
  /** Заголовок страницы («Управление записями»). */
  title: ReactNode;
  /** Подзаголовок/подсказка под заголовком. */
  subtitle?: ReactNode;
  /** Кнопки действий страницы справа. */
  actions?: ReactNode;
  /**
   * Кнопка «‹ Назад» слева от заголовка (макеты: «‹ Врачи», «← К списку»).
   */
  onBack?: () => void;
  /** Подпись кнопки назад. @default 'Назад' */
  backLabel?: ReactNode;
  /** Хлебные крошки над заголовком («Врачи / Иванов Иван Иванов»). */
  breadcrumbs?: ReactNode;
  /** Дополнительный контент под заголовком (фильтры и т.п.). */
  children?: ReactNode;
  className?: string;
  sx?: object;
}

/** SVG-шеврон влево для кнопки «Назад». */
function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
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

/**
 * Заголовок страницы (72px по макету layout.md):
 * слева — «‹ Назад» и заголовок, справа — действия страницы, снизу — опциональный контент.
 *
 * @example
 * <MpPageHeader
 *   title="Управление записями"
 *   actions={<MpButton variant="contained">Экспорт</MpButton>}
 * />
 */
export function MpPageHeader({
  title,
  subtitle,
  actions,
  onBack,
  backLabel = 'Назад',
  breadcrumbs,
  children,
  className,
  sx,
}: MpPageHeaderProps) {
  return (
    <Box
      className={className}
      sx={{
        minHeight: mpTokens.layout.pageTitle,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 1.5,
        py: 1.5,
        ...sx,
      }}
    >
      {breadcrumbs ? <Box sx={{ color: 'text.secondary' }}>{breadcrumbs}</Box> : null}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
          {onBack ? (
            <Button
              size="small"
              color="neutral"
              variant="text"
              startIcon={<ChevronLeftIcon />}
              onClick={onBack}
              sx={{ flexShrink: 0 }}
            >
              {backLabel}
            </Button>
          ) : null}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="h1" noWrap>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Box>
        </Stack>
        {actions ? (
          <Stack direction="row" spacing={1}>
            {actions}
          </Stack>
        ) : null}
      </Stack>
      {children}
    </Box>
  );
}
