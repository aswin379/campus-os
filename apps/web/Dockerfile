# Build context must be the monorepo root: docker build -f apps/web/Dockerfile .
# --build-arg VITE_API_BASE_URL=https://api.yourdomain.example/api/v1
# Vite embeds VITE_* values at BUILD time, not runtime, so the API URL the
# hosted frontend will call has to be known when the image is built.

FROM node:20-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace=packages/shared

ARG VITE_API_BASE_URL=http://localhost:4000/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build --workspace=apps/web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
