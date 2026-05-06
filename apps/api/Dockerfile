FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/types/package.json packages/types/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/ packages/
COPY apps/api/ apps/api/
COPY tsconfig.base.json ./
RUN pnpm --filter @media-manager/api build
RUN pnpm deploy --filter @media-manager/api --prod /deploy --legacy

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=build /deploy .
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/src/db/migrations ./dist/db/migrations
ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
