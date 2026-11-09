import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, useTheme, type Theme } from '@mui/material/styles';
import { useMemo, type ReactNode } from 'react';
import { createMpTheme, type MpColorMode, type MpThemeConfig } from './createTheme';

export interface MpThemeProviderProps {
  /** Режим цветовой схемы. По умолчанию `light`. */
  mode?: MpColorMode;
  /** Готовая тема — имеет приоритет над `mode`. */
  theme?: Theme;
  /** Дополнительные опции темы (применяются, если `theme` не передан). */
  config?: Omit<MpThemeConfig, 'mode'>;
  children: ReactNode;
}

/**
 * Провайдер темы mp-ui-kit: навешивает тему MUI и `CssBaseline`.
 *
 * @example
 * <MpThemeProvider mode="dark">
 *   <App />
 * </MpThemeProvider>
 */
export function MpThemeProvider({ mode = 'light', theme, config, children }: MpThemeProviderProps) {
  const resolvedTheme = useMemo(
    () => theme ?? createMpTheme({ mode, ...config }),
    [theme, mode, config],
  );

  return (
    <ThemeProvider theme={resolvedTheme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}

/** Типизированный доступ к текущей теме mp-ui-kit внутри дерева `MpThemeProvider`. */
export function useMpTheme(): Theme {
  return useTheme<Theme>();
}
