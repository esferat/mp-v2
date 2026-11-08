# Keycloak 26.2 + кастомная тема входа/регистрации/сброса пароля (Keycloakify).
#
# Тема — это расширение на classpath, поэтому jar кладётся в providers/,
# а не в themes/ (см. docs.keycloakify.dev → Deploying Your Theme).
# Монтировать каталог с jar в контейнер нельзя: JVM держит jar открытым, и
# переименование при следующей сборке темы падает с EPERM (Windows).
#
# Порядок (иначе COPY не найдёт jar):
#   pnpm --filter @mp/keycloak-theme build
#   docker compose build keycloak
FROM quay.io/keycloak/keycloak:26.2.0
COPY packages/keycloak-theme/build_keycloak/mp-portal.jar /opt/keycloak/providers/mp-portal.jar
