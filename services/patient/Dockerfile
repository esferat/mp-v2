# syntax=docker/dockerfile:1
# Сборка (из корня репо):
#   docker build -f services/patient/Dockerfile -t mp-v2/patient .
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
COPY packages/storage/package.json packages/storage/
COPY services/patient/package.json services/patient/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------- сборка
FROM deps AS build
COPY packages ./packages
COPY services/patient ./services/patient
# contracts: генерация dist + openapi/gateway.json; service-kit: tsc → dist
RUN pnpm --filter @mp/contracts gen \
  && pnpm --filter @mp/service-kit build \
  && pnpm --filter @mp/storage build \
  && pnpm --filter @mp/patient gen \
  && pnpm --filter @mp/patient build \
  # Чистый prod-набор зависимостей сервиса (включая workspace-пакеты)
  && pnpm --filter @mp/patient deploy --prod /prod/patient

# --------------------------------------------------------------- миграции
# Слим-стадия для compose-джобов db:migrate: prisma CLI уже в node_modules
# (devDependency стадии deps), исходники сервиса и tsc-сборка не нужны.
FROM deps AS migrate
COPY services/patient/prisma ./services/patient/prisma
COPY services/patient/prisma.config.ts ./services/patient/prisma.config.ts

# ---------------------------------------------------------------------- runtime
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /prod/patient ./

# Непривилегированный пользователь (0.7 AC)
USER node

EXPOSE 4003
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4003/healthz || exit 1

CMD ["node", "dist/app/main.js"]
