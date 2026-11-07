import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Аналог paths в tsconfig.json: @/* → ./src/*
    alias: { '@': path.resolve(rootDir, 'src') },
  },
  test: {
    globals: true,
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/app/**'],
    },
  },
});
