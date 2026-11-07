# syntax=docker/dockerfile:1
# Сборка (из корня репо):
#   docker build -f services/notification/Dockerfile -t mp-v2/notification .
# Multi-stage: зависимости → сборка TS + Prisma Client → минимальный runtime.

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app
# husky не должен пытаться ставить hooks в образе
ENV HUSKY=0

# ------------------------------------------------------------------ зависимости
FROM base AS deps
# Манифесты workspace — отдельным слоем: кэш не сгорает при правке исходников
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config-fsd/package.json packages/eslint-config-fsd/
COPY packages/contracts/package.json packages/contracts/
COPY packages/service-kit/package.json packages/service-kit/
COPY services/notification/package.json services/notification/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------- сборка
FROM deps AS build
COPY packages ./packages
COPY services/notification ./services/notification
# contracts: генерация dist + openapi/gateway.json; service-kit: tsc → dist
RUN pnpm --filter @mp/contracts gen \
  && pnpm --filter @mp/service-kit build \
  && pnpm --filter @mp/notification build \
  # Чистый prod-набор зависимостей сервиса (включая workspace-пакеты)
  && pnpm --filter @mp/notification deploy --prod /prod/notification

# ---------------------------------------------------------------------- runtime
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /prod/notification ./

# Непривилегированный пользователь (0.7 AC)
USER node

EXPOSE 4007
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4007/healthz || exit 1

CMD ["node", "dist/app/main.js"]
