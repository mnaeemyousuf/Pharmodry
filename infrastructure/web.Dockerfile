# Pharmodry web image (Next.js standalone). Build from the repository root:
#   docker build -f infrastructure/web.Dockerfile -t pharmodry-web .
# NOTE: written for this release but not build-verified in the development environment (Docker unavailable).
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps ./apps
ARG NEXT_PUBLIC_DEMO_MODE=false
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE BUILD_STANDALONE=true NEXT_TELEMETRY_DISABLED=1
RUN npm ci --ignore-scripts
RUN npm run build -w @pharmodry/types -w @pharmodry/validation -w @pharmodry/ui && npm run build -w @pharmodry/web

FROM node:22-bookworm-slim
WORKDIR /app
RUN useradd --system --uid 10001 pharmodry
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER pharmodry
EXPOSE 3000
# API_URL (runtime) must point at the API service, e.g. http://api:4100
CMD ["node", "apps/web/server.js"]
