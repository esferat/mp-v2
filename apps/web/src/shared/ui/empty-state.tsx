import { Box, Button, Typography } from '@mui/material';

/**
 * Пустое состояние таблицы/списка (2.2): понятный текст + действие,
 * вместо белого экрана (AC 2.4 — empty-состояния на месте).
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}): React.JSX.Element {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2 }} role="status">
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {description ? (
        <Typography color="text.secondary" sx={{ mb: actionLabel ? 2 : 0 }}>
          {description}
        </Typography>
      ) : null}
      {actionLabel && actionHref ? (
        <Button href={actionHref} variant="contained">
          {actionLabel}
        </Button>
      ) : null}
    </Box>
  );
}
