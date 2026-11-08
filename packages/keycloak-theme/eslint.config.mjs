import { createFsdConfig } from '@mp/eslint-config-fsd';

/**
 * ESLint темы Keycloak (packages/keycloak-theme): те же правила, что и в
 * остальных пакетах монорепо (FSD + TypeScript + Prettier), но со списком
 * игноров под генерируемую и вендорную часть:
 *
 * - `public/` — статика Keycloakify (CSS/JS/шрифты копируются плагином при
 *   сборке, своя линта им не нужна);
 * - `build_keycloak/` — артефакт `keycloakify build`;
 * - `src/kc.gen.tsx` — файл, генерируемый плагином Vite (см. заголовок файла).
 */
export default [
  {
    ignores: ['public/**', 'build_keycloak/**', 'dist/**', 'src/kc.gen.tsx'],
  },
  ...createFsdConfig({ root: 'src', react: true }),
];
