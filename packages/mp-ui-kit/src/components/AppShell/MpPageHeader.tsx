import Box from '@mui/material/Box';
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
  /** Дополнительный контент под заголовком (фильтры и т.п.). */
  children?: ReactNode;
  className?: string;
  sx?: object;
}

/**
 * Заголовок страницы (72px по макету layout.md):
 * слева — заголовок, справа — действия страницы, снизу — опциональный контент.
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
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Box>
          <Typography variant="h5" component="h1">
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
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
