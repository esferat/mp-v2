# syntax=docker/dockerfile:1
# Сборка (из корня репо):
#   docker build -f apps/web/Dockerfile -t mp-v2/web .
# Standalone-сборка Next.js: runtime-образ не содержит node_modules целиком.

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app
ENV HUSKY=0

# ------------------------------------------------------------------ зависимости
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config-fsd/package.json packages/eslint-config-fsd/
COPY packages/contracts/package.json packages/contracts/
COPY packages/mp-ui-kit/package.json packages/mp-ui-kit/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------- сборка
FROM deps AS build
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm --filter @mp/contracts gen \
 && pnpm --filter mp-ui-kit build \
 && pnpm --filter @mp/web build

# ---------------------------------------------------------------------- runtime
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# standalone воспроизводит дерево от outputFileTracingRoot (корень репо)
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

# Кэш Next (prerender/ISR) пишется от runtime-пользователя: сборка идёт от
# root — без chown node не создаёт .next/cache (EACCES в логах, 0.7 AC)
RUN chown -R node:node ./apps/web/.next

# Непривилегированный пользователь (0.7 AC)
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "apps/web/server.js"]
