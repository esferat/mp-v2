import { defineConfig } from 'vitest/config';

/**
 * Отдельный конфиг vitest (не подхватываем vite.config.ts, чтобы тесты не
 * запускали плагин keycloakify и не трогали сборку темы).
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
