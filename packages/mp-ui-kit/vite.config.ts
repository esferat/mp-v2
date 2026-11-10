/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Внешние зависимости не попадают в библиотеку — их предоставляет потребитель. */
import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const external = (id: string) =>
  /^(react($|\/)|react-dom($|\/)|react\/jsx-runtime|@mui\/|@emotion\/|date-fns($|\/))/.test(id);

/** Имена глобалов для IIFE/UMD-сборок (наследие lib-режима). */
const globals = {
  react: 'React',
  'react-dom': 'ReactDOM',
  'react/jsx-runtime': 'jsxRuntime',
} as const;
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'MpUiKit',
    },
    rollupOptions: {
      external,
      output: [
        {
          // ESM — по файлу на модуль (preserveModules): серверные компоненты Next
          // (RSC) импортируют только hook-free модули (MpPageHeader, MpCard…);
          // единый бандл тянет useState клиентских компонентов в RSC-граф,
          // и Next роняет сборку web («module that depends on useState»).
          format: 'es',
          dir: 'dist/es',
          preserveModules: true,
          preserveModulesRoot: 'src',
          entryFileNames: '[name].js',
          globals,
        },
        {
          // CJS — классический одиночный бандл (require-консьюмеры).
          format: 'cjs',
          dir: 'dist',
          entryFileNames: 'mp-ui-kit.cjs',
          globals,
        },
      ],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium',
              },
            ],
          },
        },
      },
    ],
  },
});
