/**
 * mp-ui-kit — дизайн-токены.
 *
 * Базовый слой: чистые значения, не зависящие от MUI.
 * Из токенов собирается тема MUI (см. `createMpTheme`).
 *
 * Цветовая схема — медицинская (бирюзовый бренд), отступы — компактные
 * (плотный админ-интерфейс, Этап 1 roadmap).
 */

/** Брендовая палитра (teal / бирюзовый). */
const brand = {
  50: '#F0FDFA',
  100: '#CCFBF1',
  200: '#99F6E4',
  300: '#5EEAD4',
  400: '#2DD4BF',
  500: '#14B8A6',
  600: '#0D9488',
  700: '#0F766E',
  800: '#115E59',
  900: '#134E4A',
} as const;

/** Нейтральная палитра (slate). */
const neutral = {
  50: '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
} as const;

/** Семантические цвета + мягкие (soft) фоны для алертов, чипов, бейджей. */
const semantic = {
  success: { main: '#16A34A', light: '#DCFCE7', dark: '#15803D', contrastText: '#FFFFFF' },
  warning: { main: '#D97706', light: '#FEF3C7', dark: '#B45309', contrastText: '#FFFFFF' },
  error: { main: '#DC2626', light: '#FEE2E2', dark: '#B91C1C', contrastText: '#FFFFFF' },
  info: { main: '#0284C7', light: '#E0F2FE', dark: '#0369A1', contrastText: '#FFFFFF' },
} as const;

/** Поверхности и цвета текста для двух режимов. */
const surfaces = {
  light: {
    background: { default: '#F6FDFC', paper: '#FFFFFF' },
    text: { primary: '#0F172A', secondary: '#475569', disabled: 'rgba(15, 23, 42, 0.38)' },
    divider: '#E2E8F0',
  },
  dark: {
    background: { default: '#0B1412', paper: '#16211F' },
    text: { primary: '#F1F5F9', secondary: '#94A3B8', disabled: 'rgba(241, 245, 249, 0.38)' },
    divider: 'rgba(203, 213, 225, 0.14)',
  },
} as const;

/** Шкала шрифтов и типографики. */
const typography = {
  fontFamily:
    '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.35,
    normal: 1.5,
    relaxed: 1.65,
  },
  /** Типографическая шкала (продуктовые размеры вместо дефолтных MUI). */
  scale: {
    display: { fontSize: 40, lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.02em' },
    h1: { fontSize: 32, lineHeight: 1.2, fontWeight: 700, letterSpacing: '-0.015em' },
    h2: { fontSize: 28, lineHeight: 1.25, fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontSize: 24, lineHeight: 1.3, fontWeight: 600, letterSpacing: '-0.01em' },
    h4: { fontSize: 20, lineHeight: 1.35, fontWeight: 600, letterSpacing: 0 },
    h5: { fontSize: 18, lineHeight: 1.4, fontWeight: 600, letterSpacing: 0 },
    h6: { fontSize: 16, lineHeight: 1.45, fontWeight: 600, letterSpacing: 0 },
    subtitle1: { fontSize: 16, lineHeight: 1.5, fontWeight: 500, letterSpacing: 0 },
    subtitle2: { fontSize: 14, lineHeight: 1.5, fontWeight: 500, letterSpacing: 0 },
    body1: { fontSize: 16, lineHeight: 1.5, fontWeight: 400, letterSpacing: 0 },
    body2: { fontSize: 14, lineHeight: 1.5, fontWeight: 400, letterSpacing: 0 },
    button: { fontSize: 14, lineHeight: 1.45, fontWeight: 600, letterSpacing: 0 },
    caption: { fontSize: 12, lineHeight: 1.4, fontWeight: 400, letterSpacing: 0 },
    overline: { fontSize: 12, lineHeight: 1.4, fontWeight: 600, letterSpacing: '0.06em' },
  },
} as const;

/**
 * Пространственная шкала (компактная): 2 · 4 · 8 · 12 · 16 · 24.
 * Базовый шаг MUI — 8px; токены задают более мелкий градиент для плотного UI.
 */
const spacing = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
} as const;

/** Скругления. */
const radius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

/** Тени. */
const shadow = {
  light: {
    sm: '0 1px 2px rgba(15, 23, 42, 0.06)',
    md: '0 2px 6px -1px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.06)',
    lg: '0 8px 24px -4px rgba(15, 23, 42, 0.10), 0 4px 12px -4px rgba(15, 23, 42, 0.06)',
    xl: '0 16px 48px -8px rgba(15, 23, 42, 0.14), 0 8px 20px -8px rgba(15, 23, 42, 0.08)',
  },
  dark: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.45)',
    md: '0 2px 6px -1px rgba(0, 0, 0, 0.50), 0 4px 12px -2px rgba(0, 0, 0, 0.40)',
    lg: '0 8px 24px -4px rgba(0, 0, 0, 0.55), 0 4px 12px -4px rgba(0, 0, 0, 0.40)',
    xl: '0 16px 48px -8px rgba(0, 0, 0, 0.60), 0 8px 20px -8px rgba(0, 0, 0, 0.45)',
  },
} as const;

/** Движение. */
const motion = {
  duration: { fast: 150, base: 200, slow: 300 },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
    decelerate: 'cubic-bezier(0, 0, 0, 1)',
    accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  },
} as const;

/** Высоты контролов (компактные). */
const controlHeight = {
  sm: 24,
  md: 32,
  lg: 40,
} as const;

/** Размеры аватаров. */
const avatarSize = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
} as const;

/**
 * Размеры оболочки приложения — по макетам
 * docs/new-project/design/layout.md (header 64, pageTitle 72, sidebar 240/72).
 */
const layout = {
  header: 64,
  pageTitle: 72,
  sidebar: 240,
  sidebarMini: 72,
} as const;

export const mpTokens = {
  brand,
  neutral,
  semantic,
  surfaces,
  typography,
  spacing,
  radius,
  shadow,
  motion,
  controlHeight,
  avatarSize,
  layout,
} as const;

export type MpTokens = typeof mpTokens;
export default mpTokens;
