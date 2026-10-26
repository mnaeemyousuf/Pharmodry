# Pharmodry — Deployment

> **Status of this release.** The application has been built and run on Windows 11 with Node 24.20 and an embedded PostgreSQL 17 cluster. The Docker files in `infrastructure/` are written but **were not built or run**, because Docker was not available in the build environment. Azure guidance below is a reference design that has not been deployed. Treat both as starting points that need verification.

## Requirements

- Node.js ≥ 20 (developed on 24.20), npm 10+ (developed with npm 11.19)
- PostgreSQL 15+ with UTF-8 encoding and the `pg_trgm` extension available
- Optional: Redis 7 (BullMQ scheduled jobs; needed when running more than one API instance)
- Optional: Mistral API key

## Local development (verified)

From the repository root:

```bash
npm install
```

```bash
npm run build:packages
```

Start PostgreSQL (port 5433, data in `.data/pg`) in its own terminal:

```bash
npm run db:start
```

Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`, then migrate and seed:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

Run API (http://localhost:4100, Swagger at `/api/docs`) and web (http://localhost:3000) in two terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Production-mode run on the same machine (what the demo uses):

```bash
npm run build
```

```bash
npm run start -w @pharmodry/api
```

```bash
npm run start -w @pharmodry/web
```

## Tests

| Command | What it does |
|---|---|
| `npm test` | API unit tests |
| `npm run test:e2e` | API e2e (Supertest) against a new throwaway database `pmd_e2e_<ts>`, created, migrated, seeded and dropped |
| `npm run test:ui` | Builds nothing. Starts an isolated environment (new DB, API :4101, web :3101) and runs the Playwright scenarios in Microsoft Edge (`channel: msedge`). Requires `npm run build` first. |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript for API and web |

## Containers (written, not verified)

```bash
cp .env.example .env
```

```bash
docker compose -f infrastructure/docker-compose.yml up -d --build
```

```bash
docker compose -f infrastructure/docker-compose.yml run --rm migrate
```

Services: `db` (Postgres 17), `redis`, `api` (:4100), `web` (:3000, `API_URL=http://api:4100`) and the `migrate` tool profile. Attachments are kept in a named volume. Do **not** seed demo data into a production database.

## Production reference design (Azure)

| Concern | Recommendation |
|---|---|
| Compute | Azure Container Apps or App Service for `api` and `web`, at least 2 replicas each. Set `REDIS_URL` when running more than one API replica, so scheduled scans run once. |
| Database | Azure Database for PostgreSQL Flexible Server with zone-redundant HA, PITR backups, private networking and TLS (`sslmode=require`). |
| Redis | Azure Cache for Redis (TLS, `rediss://`). |
| Secrets | Key Vault references for `DATABASE_URL`, `JWT_ACCESS_SECRET`, `MISTRAL_API_KEY`. |
| Files | Mounted persistent storage for `STORAGE_LOCAL_DIR` today. A Blob Storage driver is roadmap work. |
| Edge | Front Door / Application Gateway with WAF, HTTPS only, HSTS. `COOKIE_SECURE=true`. |
| Observability | Application Insights / Log Analytics. Alert on 5xx, `ACCOUNT_LOCKED`, `REUSE_DETECTED` and audit-chain verification failures. |

## Release procedure

1. Build images from a tagged commit. Record image digests in the change record.
2. Back up the database (or confirm PITR).
3. Run `npx prisma migrate deploy` as a one-off job. Never run `migrate reset` or `db push` against production.
4. Deploy the API, then the web app. Check `GET /api/v1/health`.
5. Run `GET /api/v1/audit/verify` and a smoke test with a test account.
6. In a GMP context, follow change control and execute the approved validation scripts (see `VALIDATION_NOTES.md`).

## Configuration reference

All variables are documented in `apps/api/.env.example`, `apps/web/.env.example` and the root `.env.example` (compose).

Required in production:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET` (≥ 32 characters)
- `NODE_ENV=production`
- `CORS_ORIGINS`
- `COOKIE_SECURE=true`
- `API_URL` (web)
- `NEXT_PUBLIC_DEMO_MODE=false`

## Render (demo deployment, 2026-10-25)

Two free web services in **Singapore**, built from `github.com/mnaeemyousuf/Pharmodry` (`main`, auto-deploy on push). The database is a dedicated **`pharmodry` schema** inside the existing Render Postgres `tms-demo-db` (Frankfurt), so the TMS tables are untouched. This was verified by running the whole test suite in a named schema.

| Service | Build command | Start command |
|---|---|---|
| `pharmodry-api` | `npm ci --include=dev && npm run build:packages && npm run build -w @pharmodry/api` | `node apps/api/scripts/render-start.mjs` (migrate → seed once → start) |
| `pharmodry` (web) | `npm ci --include=dev && npm run build:packages && npm run build -w @pharmodry/web` | `cd apps/web && npx next start -p $PORT` |

**API environment.** Set by deployment:
- `NODE_ENV=production`
- `NODE_VERSION=22`
- `DB_SCHEMA=pharmodry`
- `ALLOW_DEMO_SEED=true`
- `COOKIE_SECURE=true`
- `TRUST_PROXY_HOPS=2` (Render proxy + web proxy, so rate limits see real client IPs)
- `CORS_ORIGINS=<web URL>`

**Secrets the owner adds in the Render dashboard** (never committed or handled by tooling):
- `DATABASE_URL`: the connection URL of `tms-demo-db` (internal or external; with `DB_HOST_SUFFIX=.frankfurt-postgres.render.com` an internal host is converted to the external one automatically). External access must be enabled on that database (Networking → allow the services' outbound IPs, or 0.0.0.0/0 for a demo). `sslmode=require` is added automatically.
- `JWT_ACCESS_SECRET`: at least 32 random characters.

**Web environment:**
- `API_URL=<API URL>`
- `NODE_VERSION=22`
- `NEXT_PUBLIC_DEMO_MODE=true`

**Caveats:**
- Free instances sleep after about 15 minutes idle; the first request then takes about a minute.
- Services in Singapore querying a database in Frankfurt add roughly 170 ms per query.
- The local disk is ephemeral, so uploaded attachments are lost on restart or redeploy.
- `tms-demo-db` is a free Render database that Render deletes on **11 Nov 2026**. Move to a dedicated database before then.
- This is a public demo with fictional data and the documented demo password. Do not enter real data.
