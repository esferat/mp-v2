import type { NextConfig } from 'next';

/**
 * Конфигурация Next.js (16, App Router, SSR — architecture.md §6.1).
 * Клиентский код не ходит в gateway напрямую: только /api/bff/* (BFF).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Самодостаточный стендлон — для Docker-образа (не тащим node_modules)
  output: 'standalone',
  // Монорепо: корень для output-file-tracing (стендлоны вне apps/web)
  outputFileTracingRoot: process.cwd() + '/../..',
  experimental: {
    // Датапикеры экспортируют сотни модулей — грузим только используемые
    // (в дефолтный список Next 16 не входят, в отличие от @mui/material).
    optimizePackageImports: ['@mui/x-date-pickers'],
  },
  // Проксируется nginx (/media → MinIO), поэтому basePath не задаём
  async rewrites() {
    return [];
  },
};

export default nextConfig;
