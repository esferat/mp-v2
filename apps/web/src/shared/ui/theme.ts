import { alpha, createTheme, type Theme } from '@mui/material';

/**
 * Единая тема портала (2.2: дизайн-система в shared/ui — все компоненты
 * берут токены отсюда, прямой импорт @mui/* во фичах запрещён FSD-линтом).
 *
 * «Краски» проекта живут тоже здесь: градиенты бренда (шапка, акценты)
 * и переопределения компонентов (активный пункт меню, шапка таблицы,
 * аватары, фон страницы). Компоненты ссылаются на токены через sx — без
 * «магических» цветов (functional-spec 2.2).
 */

// Градиенты бренда — кастомные токены темы (module augmentation MUI).
declare module '@mui/material/styles' {
  interface Theme {
    /** Градиенты бренда: для шапки, акцентов и карточек. */
    gradients: { brand: string; brandSoft: string };
  }
  interface ThemeOptions {
    gradients?: { brand: string; brandSoft: string };
  }
}

export const theme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' },
    secondary: { main: '#00897b' },
    error: { main: '#d32f2f' },
    // warning.dark: дефолт MUI #e65100 даёт 3.79:1 к белому (ниже AA) —
    // затемняем до 5.6:1, чтобы цветные заголовки/акценты читались.
    warning: { main: '#ed6c02', dark: '#bf3608' },
    background: { default: '#f5f7fa' },
  },
  // Фирменный переход: синий (primary) → бирюза. Концы — тёмные оттенки
  // палитры (primary.dark #1565c0, secondary.dark #00695c): белый текст
  // на градиенте должен давать контраст ≥ 4.5:1 (WCAG AA).
  gradients: {
    brand: 'linear-gradient(90deg, #1565c0 0%, #1976d2 45%, #00695c 100%)',
    brandSoft: 'linear-gradient(90deg, #e3f2fd 0%, #e0f2f1 100%)',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: { defaultProps: { elevation: 1 } },
    MuiAppBar: {
      styleOverrides: {
        // Шапка — фирменный градиент поверх background-color, текст белый
        // (header использует color="primary": contrastText уже белый).
        root: ({ theme: t }) => ({
          backgroundImage: t.gradients.brand,
          color: t.palette.common.white,
        }),
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        // Активный пункт меню: светлый подтон primary (alpha по белому —
        // ≥ 6:1 к primary.dark) + левая бирюзовая полоса. Слота selected у
        // resolver нет — стилизуем через &.Mui-selected; menu.test проверяет
        // только класс Mui-selected — он сохраняется.
        root: ({ theme: t }) => ({
          '&.Mui-selected': {
            backgroundColor: alpha(t.palette.primary.main, 0.12),
            color: t.palette.primary.dark,
            fontWeight: 600,
            borderLeft: `4px solid ${t.palette.secondary.main}`,
            paddingLeft: 12, // компенсируем полосу: 4 + 12 = 16 как у gutters
            '&:hover': { backgroundColor: alpha(t.palette.primary.main, 0.16) },
          },
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        // Шапка таблицы — мягкий градиент бренда вместо прозрачной.
        head: ({ theme: t }) => ({
          backgroundImage: t.gradients.brandSoft,
          color: t.palette.primary.dark,
          fontWeight: 700,
        }),
      },
    },
    MuiAvatar: {
      styleOverrides: {
        // Инициалы-аватары (врачи, пациенты): сплошной primary с белым
        // текстом (4.6:1 — норма AA) вместо серого colorDefault.
        colorDefault: ({ theme: t }) => ({
          backgroundColor: t.palette.primary.main,
          color: t.palette.common.white,
        }),
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        // Фон страницы — мягкий вертикальный градиент вместо плоского серого.
        body: {
          backgroundImage: 'linear-gradient(180deg, #eef4fb 0%, #f5f7fa 480px)',
          backgroundRepeat: 'no-repeat',
        },
      },
    },
  },
});
