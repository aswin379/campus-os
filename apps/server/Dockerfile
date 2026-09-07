# Build context must be the monorepo root: docker build -f apps/server/Dockerfile .
# (npm workspaces need the root package.json + lockfile to resolve @erp/shared.)

FROM node:20-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/server/package.json apps/server/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npm run build --workspace=packages/shared \
 && npm run build --workspace=apps/server

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/server/package.json apps/server/package.json
RUN npm ci --omit=dev

COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/server/dist apps/server/dist

RUN addgroup -S erp && adduser -S erp -G erp

# Everything under /repo/data must survive container restarts/rebuilds:
# uploaded student photos (STORAGE_LOCAL_PATH), and the license file +
# generated instance id (see src/lib/license/). Created (and owned by erp)
# before USER switches, or a fresh named volume mounted here would default
# to root:root and the non-root process below couldn't write to it — every
# photo upload would fail with EACCES, and a new instance id would be
# generated on every restart, breaking the license check each time.
RUN mkdir -p /repo/data/uploads && chown -R erp:erp /repo/data
VOLUME ["/repo/data"]

USER erp

EXPOSE 4000
CMD ["node", "apps/server/dist/server.js"]
