import type { ReactNode } from 'react';
import { Box } from '@mui/material';

/**
 * Цвета статусов записи/врача/истории — из темы (2.2: токены только через
 * тему, «сырые» цвета в компонентах запрещены).
 */
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'primary';

/** Бейдж статуса «точка + цветной текст» (visual/_shared.css `.status`): точка 8×8 и подпись 12px/600. */
export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: ReactNode;
  tone?: StatusTone;
}): React.JSX.Element {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        color: tone === 'neutral' ? 'text.secondary' : `${tone}.main`,
        '& .StatusBadge-dot': {
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          backgroundColor: tone === 'neutral' ? 'neutral.light' : `${tone}.main`,
        },
      }}
    >
      <Box component="span" className="StatusBadge-dot" aria-hidden />
      {label}
    </Box>
  );
}
