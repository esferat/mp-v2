import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { keycloakify } from 'keycloakify/vite-plugin';

// Тема Keycloak (вход/регистрация/сброс пароля) в стиле портала.
// Сборка: pnpm --filter @mp/keycloak-theme build → build_keycloak/mp-portal.jar
export default defineConfig({
  plugins: [
    react(),
    keycloakify({
      themeName: 'mp-portal',
      // Account-тема не кастомизируется (0.4 — в её объём не входит)
      accountThemeImplementation: 'none',
      // Один JAR под наш Keycloak 26.2: каталог build_keycloak монтируется
      // в /opt/keycloak/providers контейнера, второй JAR с той же темой
      // создал бы дубль темы в classpath.
      keycloakVersionTargets: {
        '22-to-25': false,
        'all-other-versions': 'mp-portal.jar',
      },
      keycloakifyBuildDirPath: 'build_keycloak',
    }),
  ],
});
