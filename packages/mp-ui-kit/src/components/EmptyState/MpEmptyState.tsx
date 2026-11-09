import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

export interface MpEmptyStateProps {
  /** Иконка (например, из `@mui/icons-material`). */
  icon?: ReactNode;
  /** Заголовок: «Ничего не найдено». */
  title: ReactNode;
  /** Пояснение: «На эту дату свободных окон нет — выберите другую». */
  description?: ReactNode;
  /** Действие: «Создать врача» и т.п. */
  action?: ReactNode;
  /** Размер. @default 'medium' */
  size?: 'small' | 'medium';
  className?: string;
  sx?: object;
}

/**
 * Пустое состояние страницы/таблицы: иконка + текст + действие
 * (design/README.md, состояние `empty`).
 *
 * @example
 * <MpEmptyState
 *   icon={<SearchOffIcon />}
 *   title="Ничего не найдено"
 *   description="Измените фильтры или создайте врача"
 *   action={<MpButton variant="contained">Создать врача</MpButton>}
 * />
 */
export function MpEmptyState({
  icon,
  title,
  description,
  action,
  size = 'medium',
  className,
  sx,
}: MpEmptyStateProps) {
  const iconSize = size === 'small' ? 28 : 40;

  return (
    <Stack
      className={className}
      spacing={0.75}
      sx={{ alignItems: 'center', textAlign: 'center', py: size === 'small' ? 3 : 5, px: 2, ...sx }}
    >
      {icon ? (
        <Box
          sx={{
            color: 'text.disabled',
            display: 'flex',
            '& svg': { fontSize: iconSize, width: iconSize, height: iconSize },
          }}
        >
          {icon}
        </Box>
      ) : null}
      <Typography variant={size === 'small' ? 'subtitle2' : 'h6'}>{title}</Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      ) : null}
      {action ? <Box sx={{ mt: 1 }}>{action}</Box> : null}
    </Stack>
  );
}
