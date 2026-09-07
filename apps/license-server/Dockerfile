# Build context must be the monorepo root: docker build -f apps/license-server/Dockerfile .

FROM node:20-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/license-server/package.json apps/license-server/package.json
RUN npm ci

COPY apps/license-server apps/license-server
RUN npm run build --workspace=apps/license-server

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/license-server/package.json apps/license-server/package.json
RUN npm ci --omit=dev --workspace=apps/license-server

COPY --from=build /repo/apps/license-server/dist apps/license-server/dist
COPY --from=build /repo/apps/license-server/public apps/license-server/public

RUN addgroup -S license && adduser -S license -G license

# The licenses.json data file must survive container restarts/rebuilds —
# created (and owned by the non-root user) before USER switches, same
# reasoning as apps/server's uploads volume.
RUN mkdir -p /repo/apps/license-server/data && chown -R license:license /repo/apps/license-server/data
VOLUME ["/repo/apps/license-server/data"]

USER license

EXPOSE 4100
CMD ["node", "apps/license-server/dist/server.js"]
