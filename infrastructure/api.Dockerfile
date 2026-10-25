# Pharmodry API image. Build from the repository root:
#   docker build -f infrastructure/api.Dockerfile -t pharmodry-api .
# NOTE: written for this release but not build-verified in the development environment (Docker unavailable).
FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm ci --ignore-scripts && npx --workspace @pharmodry/api prisma generate
RUN npm run build -w @pharmodry/types -w @pharmodry/validation && npm run build -w @pharmodry/api

FROM node:22-bookworm-slim
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 10001 pharmodry
ENV NODE_ENV=production PORT=4100
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
WORKDIR /repo/apps/api
RUN mkdir -p storage && chown pharmodry storage
USER pharmodry
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:4100/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Migrations run as a separate release step: `npx prisma migrate deploy` (see docs/DEPLOYMENT.md).
CMD ["node", "--enable-source-maps", "dist/main.js"]
