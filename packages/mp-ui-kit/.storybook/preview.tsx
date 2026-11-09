import { CssBaseline, ThemeProvider } from '@mui/material';
import type { Decorator, Preview } from '@storybook/react-vite';
import { useMemo } from 'react';
import { createMpTheme, type MpColorMode } from '../src/theme';

/** Оборачивает каждую историю в тему mp-ui-kit с переключателем светлой/тёмной схемы. */
const withMpTheme: Decorator = (Story, context) => {
  const mode: MpColorMode = context.globals.theme === 'dark' ? 'dark' : 'light';
  const theme = useMemo(() => createMpTheme({ mode }), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <Story />
    </ThemeProvider>
  );
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Цветовая схема',
      toolbar: {
        title: 'Тема',
        items: [
          { value: 'light', title: 'Светлая' },
          { value: 'dark', title: 'Тёмная' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
  },
  tags: ['autodocs'],
  decorators: [withMpTheme],
  parameters: {
    layout: 'padded',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 'todo' — замечания a11y в UI тестов; 'error' — валить CI; 'off' — выключить
      test: 'todo',
    },
    docs: {
      source: { state: 'open' },
    },
  },
};

export default preview;
