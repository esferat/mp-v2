import { createMpTheme, type MpColorMode, mpTokens } from 'mp-ui-kit';

/**
 * Единая тема портала (2.2) — на дизайн-токенах mp-ui-kit (visual/index.html:
 * «Источник токенов — библиотека mp-ui-kit», бирюзовый бренд #0D9488).
 *
 * Фон страницы — плоский #F5F7FA из палитры кита (surfaces.light.background.
 * default, визуал _shared.css --bg): CssBaseline MUI сам красит body в
 * background.default. Компоненты ссылаются на токены через sx — без
 * «магических» цветов (functional-spec 2.2).
 */

// Градиенты бренда — кастомные токены темы (module augmentation MUI).
declare module '@mui/material/styles' {
  interface Theme {
    /** Градиенты бренда: для героя лендинга и акцентных полос. */
    gradients: { brand: string; brandSoft: string };
  }

  interface ThemeOptions {
    gradients?: { brand: string; brandSoft: string };
  }
}

/**
 * Тема приложения = тема mp-ui-kit + «краски» приложения.
 * Тёмный режим — через createAppTheme('dark') (задача Этапа 3).
 */
export function createAppTheme(mode: MpColorMode = 'light') {
  const appTheme = createMpTheme({ mode });

  // Герой лендинга и акцентные полосы. Концы — тёмные оттенки брендовой
  // шкалы (brand-700/800): белый текст на градиенте даёт контраст ≥ 4.5:1 (WCAG AA).
  appTheme.gradients = {
    brand: `linear-gradient(90deg, ${mpTokens.brand[700]} 0%, ${mpTokens.brand[600]} 45%, ${mpTokens.brand[800]} 100%)`,
    brandSoft: `linear-gradient(90deg, ${mpTokens.brand[50]} 0%, ${mpTokens.brand[100]} 100%)`,
  };

  return appTheme;
}

export const theme = createAppTheme();
