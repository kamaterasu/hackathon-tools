FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/types/package.json packages/types/
COPY apps/admin/package.json apps/admin/
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_PLAYER_URL
ENV VITE_PLAYER_URL=$VITE_PLAYER_URL
COPY packages/ packages/
COPY apps/admin/ apps/admin/
COPY tsconfig.base.json ./
RUN pnpm --filter admin build

FROM nginx:alpine
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
