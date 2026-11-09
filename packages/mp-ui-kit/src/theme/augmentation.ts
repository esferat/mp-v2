/**
 * Расширения типов MUI (module augmentation).
 *
 * Делает доступными собственные цвета палитры (`brand`, `neutral`)
 * в пропсах компонентов: `<MpButton color="neutral">`, `<MpChip color="brand">`.
 */
import type { CSSProperties } from 'react';

export {};

declare module '@mui/material/styles' {
  interface Palette {
    /** Брендовый цвет (индиго). */
    brand: Palette['primary'];
    /** Нейтральный серый — для «вторичных» действий. */
    neutral: Palette['primary'];
  }

  interface PaletteOptions {
    brand?: PaletteOptions['primary'];
    neutral?: PaletteOptions['primary'];
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    neutral: true;
  }
}

declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
    brand: true;
    neutral: true;
  }
}

declare module '@mui/material/Fab' {
  interface FabPropsColorOverrides {
    neutral: true;
  }
}

declare module '@mui/material/Badge' {
  interface BadgePropsColorOverrides {
    brand: true;
    neutral: true;
  }
}

// Моноширинный вариант типографики («Typography mono» — время приёма, ID записей).
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    mono: true;
  }
}

declare module '@mui/material/styles' {
  interface TypographyVariants {
    mono: CSSProperties;
  }
  interface TypographyVariantsOptions {
    mono?: CSSProperties;
  }
}
