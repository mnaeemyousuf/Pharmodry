<img src="docs/BRAND/logo/pharmodry-logo.svg" alt="Pharmodry — Precision in Every Batch." width="360"/>

# Pharmodry — Pharmaceutical Operations, Quality & Compliance Intelligence Platform

*Precision in Every Batch.*

Pharmodry is a multi-tenant web platform for pharmaceutical **manufacturers**, built first for Pakistan (DRAP / PIC/S GMP). It connects procurement, quarantine and QC, inventory with FEFO, production plans, electronic batch records (eBMR), QA release, OOS investigations, deviations and CAPA. A regulated-record backbone underpins all of it: an immutable, hash-chained audit trail; electronic signatures with re-authentication; configurable, site-scoped permissions; and segregation of duties. A management Command Center, analytics, traceability with mock recall, a Product Quality Review data pack and a Mistral-powered copilot sit on top. The copilot is advisory only.

> **Status:** MVP / demonstration release with fictional data. Pharmodry is **not validated** for GMP use and is **not** approved by any regulator. See [docs/VALIDATION_NOTES.md](docs/VALIDATION_NOTES.md) and [docs/DEMO/KNOWN_LIMITATIONS.md](docs/DEMO/KNOWN_LIMITATIONS.md).

## Stack

| Layer | Technology |
|---|---|
| Web | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Radix/shadcn-style components, TanStack Query, React Hook Form + Zod, Recharts |
| API | NestJS 11 REST `/api/v1`, Swagger at `/api/docs`, class-validator DTOs |
| Data | PostgreSQL (17 in development) via Prisma 6, DB-level append-only triggers and CHECK constraints |
| Jobs | BullMQ on Redis when `REDIS_URL` is set; otherwise an in-process scheduler |
| Auth | JWT access tokens + rotating httpOnly refresh cookie; scrypt password hashes |
| AI | Mistral via a server-side `LLMProvider` abstraction, with a deterministic fallback |
| Tests | Jest (unit), Jest + Supertest (API e2e on real PostgreSQL), Playwright (browser scenarios) |

Repository layout: `apps/api`, `apps/web`, `packages/{types,validation,ui,config}`, `infrastructure/`, `docs/`. Details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quick start (local)

Requires Node.js ≥ 20. From the repository root:

```bash
npm install
```

```bash
npm run build:packages
```

In a separate terminal, start the embedded PostgreSQL on port 5433:

```bash
npm run db:start
```

Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`, then:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Open http://localhost:3000. The API runs on http://localhost:4100 (Swagger: http://localhost:4100/api/docs). More options, including containers, are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Demo

Demo company **NovaCure Pharmaceuticals Pvt Ltd** (Karachi plant), with products Paracetamol 500 mg tablets, Amoxicillin 500 mg capsules and Omeprazole 20 mg capsules. All data is fictional.

- Demo accounts are `<role>@novacure.demo`, e.g. `qa.manager@`, `qc.analyst@`, `warehouse.officer@`, `operator@`, `planner@`, `management@`. The full list is in [docs/DEMO/DEMO_DATA_GUIDE.md](docs/DEMO/DEMO_DATA_GUIDE.md).
- Password: the value of `SEED_DEMO_PASSWORD` at seed time. The development default is `Pharmodry!Demo26` — a local-demo credential for fictional data, never to be used elsewhere.
- Scenarios: A (successful release), B (dissolution 74 % vs ≥ 80 % → OOS → deviation → CAPA), C (material shortage blocks reservation), D (batch in progress), E (receipt awaiting QC). Walkthrough: [docs/DEMO/DEMO_WALKTHROUGH.md](docs/DEMO/DEMO_WALKTHROUGH.md).

## Tests

```bash
npm test
```

```bash
npm run test:e2e
```

```bash
npm run build
```

```bash
npm run test:ui
```

`test:e2e` and `test:ui` each create a throwaway database and drop it afterwards. Results from this release are in [docs/AUDIT/FINAL_TEST_REPORT.md](docs/AUDIT/FINAL_TEST_REPORT.md).

## Documentation

| Topic | File |
|---|---|
| Brand guidelines (logo, colours, typography) | [docs/BRAND/BRAND_GUIDELINES.md](docs/BRAND/BRAND_GUIDELINES.md) |
| Rebrand report (Pharma360 → Pharmodry) | [docs/BRAND/REBRAND_REPORT.md](docs/BRAND/REBRAND_REPORT.md) |
| Product requirements | [docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md) |
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Database | [docs/DATABASE.md](docs/DATABASE.md) |
| API | [docs/API.md](docs/API.md) |
| Security | [docs/SECURITY.md](docs/SECURITY.md) |
| AI architecture | [docs/AI_ARCHITECTURE.md](docs/AI_ARCHITECTURE.md) |
| Deployment | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Validation notes | [docs/VALIDATION_NOTES.md](docs/VALIDATION_NOTES.md) |
| Audit & test reports | [docs/AUDIT/](docs/AUDIT/) |
| Industry research | [docs/RESEARCH/](docs/RESEARCH/) |
| Demo guides | [docs/DEMO/](docs/DEMO/) |
| Role-based user manuals (PDF) | [docs/USER_MANUALS/](docs/USER_MANUALS/) |
| Final delivery report | [docs/FINAL_DELIVERY_REPORT.md](docs/FINAL_DELIVERY_REPORT.md) |
