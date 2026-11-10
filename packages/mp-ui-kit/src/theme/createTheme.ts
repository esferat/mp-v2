import { alpha, createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';
import { mpTokens as t } from './tokens';
// Подключает module augmentation для кастомных цветов палитры.
import './augmentation';

export type MpColorMode = 'light' | 'dark';

export interface MpThemeConfig {
  /** Режим цветовой схемы. По умолчанию `light`. */
  mode?: MpColorMode;
  /** Дополнительные опции — накладываются поверх базовых. */
  components?: ThemeOptions['components'];
}

/** Мягкая тень для карточек/меню с учётом режима. */
const surfaceShadow = (mode: MpColorMode) =>
  mode === 'light' ? t.shadow.light.md : t.shadow.dark.md;

/** Массив теней MUI (25 уровней), собранный из токенов. */
function buildShadows(mode: MpColorMode): ThemeOptions['shadows'] {
  const s = mode === 'light' ? t.shadow.light : t.shadow.dark;
  const levels = ['none', s.sm, s.sm, s.md, s.md, s.md];
  const rest = [...Array(6).fill(s.lg), ...Array(13).fill(s.xl)];
  return [...levels, ...rest] as ThemeOptions['shadows'];
}

/**
 * Создаёт тему mp-ui-kit на основе дизайн-токенов.
 *
 * Цветовая схема — медицинская (бирюзовый бренд), отступы — компактные.
 *
 * @example
 * const theme = createMpTheme({ mode: 'dark' });
 * <ThemeProvider theme={theme}>...</ThemeProvider>
 */
export function createMpTheme(config: MpThemeConfig = {}): Theme {
  const { mode = 'light', components: extraComponents } = config;
  const isLight = mode === 'light';
  const surface = isLight ? t.surfaces.light : t.surfaces.dark;

  const options: ThemeOptions = {
    palette: {
      mode,
      primary: {
        main: t.brand[600],
        light: t.brand[400],
        dark: t.brand[700],
        contrastText: '#FFFFFF',
      },
      secondary: { main: '#2563EB', light: '#60A5FA', dark: '#1D4ED8', contrastText: '#FFFFFF' },
      brand: {
        main: t.brand[500],
        light: t.brand[300],
        dark: t.brand[700],
        contrastText: '#FFFFFF',
      },
      neutral: {
        main: t.neutral[500],
        light: t.neutral[300],
        dark: t.neutral[700],
        contrastText: '#FFFFFF',
      },
      success: { ...t.semantic.success },
      warning: { ...t.semantic.warning },
      error: { ...t.semantic.error },
      info: { ...t.semantic.info },
      background: { ...surface.background },
      text: { ...surface.text },
      divider: surface.divider,
      action: {
        active: isLight ? alpha(surface.text.primary, 0.62) : alpha(surface.text.primary, 0.7),
        hover: isLight ? alpha(surface.text.primary, 0.05) : alpha(surface.text.primary, 0.07),
        hoverOpacity: 0.06,
        selected: isLight ? alpha(t.brand[600], 0.1) : alpha(t.brand[400], 0.14),
        disabled: isLight ? 'rgba(15, 23, 42, 0.32)' : 'rgba(241, 245, 249, 0.32)',
        disabledBackground: isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(241, 245, 249, 0.12)',
      },
    },
    typography: {
      fontFamily: t.typography.fontFamily,
      fontWeightRegular: t.typography.fontWeight.regular,
      fontWeightMedium: t.typography.fontWeight.medium,
      fontWeightBold: t.typography.fontWeight.bold,
      h1: t.typography.scale.h1,
      h2: t.typography.scale.h2,
      h3: t.typography.scale.h3,
      h4: t.typography.scale.h4,
      h5: t.typography.scale.h5,
      h6: t.typography.scale.h6,
      subtitle1: t.typography.scale.subtitle1,
      subtitle2: t.typography.scale.subtitle2,
      body1: t.typography.scale.body1,
      body2: t.typography.scale.body2,
      button: t.typography.scale.button,
      caption: t.typography.scale.caption,
      overline: {
        ...t.typography.scale.overline,
        textTransform: 'uppercase',
      },
    },
    shape: { borderRadius: t.radius.md },
    // Брейкпоинты — по макетам design/*: ≥1280 desktop, 960–1279 tablet, <960 mobile.
    breakpoints: { values: { xs: 0, sm: 600, md: 960, lg: 1280, xl: 1536 } },
    shadows: buildShadows(mode),
    components: {
      // ——— Типографика ———
      MuiTypography: {
        variants: [
          {
            // Время приёма, идентификаторы (макеты: «Typography mono», design/appointments.md).
            props: { variant: 'mono' },
            style: {
              fontFamily: t.typography.fontFamilyMono,
              fontSize: t.typography.scale.body2.fontSize,
              lineHeight: t.typography.scale.body2.lineHeight,
              letterSpacing: 0,
            },
          },
        ],
      },

      // ——— Кнопки и иконки ———
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: t.typography.fontWeight.semibold,
            letterSpacing: 0,
            borderRadius: t.radius.md,
            minHeight: t.controlHeight.md,
            paddingLeft: 12,
            paddingRight: 12,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
        },
        variants: [
          {
            props: { size: 'small' },
            style: { minHeight: t.controlHeight.sm, paddingLeft: 8, paddingRight: 8, fontSize: 13 },
          },
          {
            props: { size: 'large' },
            style: {
              minHeight: t.controlHeight.lg,
              paddingLeft: 16,
              paddingRight: 16,
              fontSize: 15,
            },
          },
          {
            props: { color: 'neutral', variant: 'contained' },
            style: {
              backgroundColor: t.neutral[500],
              color: '#FFFFFF',
              '&:hover': { backgroundColor: t.neutral[600] },
              '&:active': { backgroundColor: t.neutral[700] },
            },
          },
          {
            props: { color: 'neutral', variant: 'outlined' },
            style: {
              color: t.neutral[600],
              borderColor: alpha(t.neutral[500], 0.5),
              '&:hover': {
                borderColor: t.neutral[600],
                backgroundColor: alpha(t.neutral[500], 0.08),
              },
            },
          },
          {
            props: { color: 'neutral', variant: 'text' },
            style: {
              color: t.neutral[600],
              '&:hover': { backgroundColor: alpha(t.neutral[500], 0.08) },
            },
          },
        ],
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: t.radius.sm },
          sizeMedium: { width: t.controlHeight.md, height: t.controlHeight.md },
        },
      },

      // ——— Формы ———
      MuiTextField: {
        defaultProps: { size: 'small', variant: 'outlined' },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: t.radius.md,
            backgroundColor: isLight ? t.neutral[50] : alpha(t.neutral[900], 0.4),
            '& fieldset': { borderColor: isLight ? t.neutral[300] : 'rgba(203, 213, 225, 0.24)' },
            '&:hover fieldset': {
              borderColor: isLight ? t.neutral[400] : 'rgba(203, 213, 225, 0.4)',
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: { root: { fontWeight: t.typography.fontWeight.medium } },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: { marginTop: 2, marginLeft: 4, fontSize: t.typography.scale.caption.fontSize },
        },
      },
      MuiFormControlLabel: {
        styleOverrides: { root: { marginLeft: 0 } },
      },

      // ——— Навигация и меню ———
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'default' },
        styleOverrides: {
          // Макет `.appbar`: фон — белый surface, как у бокового меню
          // (иначе color="default" даёт palette.background.default — серый)
          colorDefault: { backgroundColor: surface.background.paper },
          root: { borderBottom: `1px solid ${surface.divider}`, backgroundImage: 'none' },
        },
      },
      MuiToolbar: {
        styleOverrides: { root: { minHeight: t.layout.header } },
      },
      MuiDrawer: {
        styleOverrides: { paper: { borderColor: surface.divider } },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            minHeight: 36,
            paddingTop: 6,
            paddingBottom: 6,
            paddingLeft: 12,
            paddingRight: 12,
            borderRadius: t.radius.md,
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: { root: { minWidth: 36, color: 'inherit' } },
      },
      MuiListItemText: {
        styleOverrides: { primary: { fontSize: 14, lineHeight: 1.4 } },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { borderRadius: t.radius.md, marginTop: 4 },
          list: { paddingTop: 4, paddingBottom: 4 },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            minHeight: 32,
            paddingTop: 6,
            paddingBottom: 6,
            paddingLeft: 12,
            paddingRight: 12,
            marginInline: 4,
            borderRadius: t.radius.sm,
            fontSize: 14,
          },
        },
      },

      // ——— Таблицы ———
      MuiTableCell: {
        styleOverrides: {
          root: { paddingTop: 6, paddingBottom: 6, paddingLeft: 12, paddingRight: 12 },
          head: {
            fontWeight: t.typography.fontWeight.semibold,
            fontSize: 13,
            color: surface.text.secondary,
          },
        },
      },
      MuiTablePagination: {
        // Высота подвала: чип 24 + padding 8×2 = 40 (.pagination макета).
        // Именно minHeight (не height): тулбар может быть выше — фикс-высота
        // давала вертикальный скролл внутри бокса (root имеет overflow: auto).
        styleOverrides: { root: { minHeight: 40 } },
      },

      // ——— Диалоги и тосты ———
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: t.radius.lg } },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            padding: '12px 16px',
            fontSize: 16,
            fontWeight: t.typography.fontWeight.semibold,
            lineHeight: 1.4,
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: { root: { padding: '12px 16px' } },
      },
      MuiDialogActions: {
        styleOverrides: { root: { padding: '8px 16px', gap: t.spacing.sm } },
      },
      MuiSnackbar: {
        styleOverrides: { root: { left: t.spacing.lg, right: t.spacing.lg } },
      },

      // ——— Информационные блоки ———
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: t.radius.lg,
            border: `1px solid ${surface.divider}`,
            backgroundImage: 'none',
            boxShadow: surfaceShadow(mode),
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: t.spacing.md,
            '&:last-child': { paddingBottom: t.spacing.md },
          },
        },
      },
      MuiCardActions: {
        styleOverrides: {
          root: { padding: t.spacing.md, gap: t.spacing.sm },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: t.typography.fontWeight.medium, borderRadius: t.radius.full },
        },
        // Цвета `brand` и `neutral` работают автоматически: MUI берёт их из палитры темы.
      },
      MuiAlert: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: {
            borderRadius: t.radius.md,
            alignItems: 'flex-start',
            paddingTop: 6,
            paddingBottom: 6,
            paddingLeft: 12,
            paddingRight: 12,
          },
        },
      },
      MuiAlertTitle: {
        styleOverrides: {
          root: { marginBottom: 0, fontWeight: t.typography.fontWeight.semibold },
        },
      },
      MuiBadge: {
        styleOverrides: {
          badge: { fontWeight: t.typography.fontWeight.semibold, letterSpacing: 0 },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: { fontWeight: t.typography.fontWeight.semibold, color: '#FFFFFF' },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: t.radius.sm,
            fontSize: t.typography.scale.caption.fontSize,
            backgroundColor: isLight ? t.neutral[800] : t.neutral[200],
            color: isLight ? t.neutral[50] : t.neutral[900],
          },
        },
      },
      ...extraComponents,
    },
  };

  return createTheme(options);
}

/** Дефолтная тема mp-ui-kit (светлая). Используйте только для типов/сторис. */
export const mpTheme = createMpTheme({ mode: 'light' });
