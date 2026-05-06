FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/types/package.json packages/types/
COPY apps/player/package.json apps/player/
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY packages/ packages/
COPY apps/player/ apps/player/
COPY tsconfig.base.json ./
RUN pnpm --filter player build

FROM nginx:alpine
COPY --from=build /app/apps/player/dist /usr/share/nginx/html
COPY apps/player/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
