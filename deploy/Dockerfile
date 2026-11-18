# The hosted dashboard. Build context = the repo root, cut down by deploy/Dockerfile.dockerignore (local builds) and
# .gcloudignore (Cloud Build uploads) to dashboard/, the store and the register:
#
#   docker build -f deploy/Dockerfile --build-arg DASHBOARD_COMMIT=<short commit> -t <image> .
#
# glibc base (not Alpine): DuckDB's native module ships a gnu build. The password is never in the image: Cloud Run
# passes DASHBOARD_PASSWORD from Secret Manager at run time, and without it every request is refused.

FROM node:22.23.5-bookworm-slim AS build
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/dashboard
COPY dashboard/package.json dashboard/package-lock.json ./
# The lockfile is written by npm 11 (Node 24 on our machines); the npm 10 in this image reads it as out of sync.
RUN npm install --global --no-audit --no-fund npm@11.6.2 && npm ci --no-audit --no-fund
COPY dashboard/ ./
# Pages read the store at request time, so the build needs no data. The build cache and dev packages go after the build.
RUN node node_modules/next/dist/bin/next build && rm -rf .next/cache && npm prune --omit=dev --no-audit --no-fund

FROM node:22.23.5-bookworm-slim AS run
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 DASHBOARD_REQUIRE_PASSWORD=1
ARG DASHBOARD_COMMIT
ENV DASHBOARD_COMMIT=$DASHBOARD_COMMIT
WORKDIR /app/dashboard
# Owned by root, read-only to the app; only Next's cache folder is writable by node.
COPY --from=build /app/dashboard ./
COPY outputs/store.duckdb outputs/02_defect_register.csv /app/outputs/
RUN mkdir -p .next/cache && chown node:node .next/cache
USER node
EXPOSE 8080
# Shell form so $PORT expands; exec so node is PID 1 and gets Cloud Run's SIGTERM itself.
CMD exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p $PORT
