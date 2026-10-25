# Architecture as Delivered (audit view)

Detailed design: `docs/ARCHITECTURE.md`. This page records what was **verified to exist and run** at the end of the audit (2026-10-18), and where the implementation differs from the original design.

## Runtime topology (verified locally)

```
Browser ──► Next.js 15 (web, :3000)
              └─ /api/v1/* route handler (same origin) ──► NestJS 11 API (:4100) ──► PostgreSQL 17 (:5433)
                                                              ├─ in-process scheduler (no Redis configured)
                                                              ├─ local file storage (attachments)
                                                              └─ Mistral API (not configured → deterministic fallback)
```

## Inventory of components

| Component | Size / content | Verified by |
|---|---|---|
| `packages/types` | statuses & state machines, ~59 permissions, 19 default roles, tenant settings, spec evaluation, yield, GS1 helpers | unit tests (35) |
| `apps/api` | 20 domain modules, ~150 REST endpoints, Swagger | API e2e (78 tests) |
| Prisma schema | 58 models, 36 enums, 3 migrations | migrations applied to fresh DBs on every test run |
| `apps/web` | 53 routes (incl. traceability, PQR) | `next build`, Playwright (3 scenarios) |
| Seed | 2 tenants, 22 users, master data, 6-month history, 5 live scenarios through services | runs before every e2e/UI test run |
| `infrastructure/` | embedded Postgres launcher, isolated test-env runner, Dockerfiles, compose | launcher & runner: used daily. Docker: **not verified** |

## Deviations from the original design

| Design said | As built | Reason / impact |
|---|---|---|
| Next.js rewrites proxy `/api/v1` | Route handler `app/api/v1/[...path]/route.ts` reading `API_URL` at runtime | Rewrites are fixed at build time; the runtime handler lets the same build target any API host |
| API port 4000 | 4100 | Port conflict with another local application |
| StorageProvider with S3 | Local driver only | S3/Blob driver deferred (P2) |
| `ErpAdapter` / `NullErpAdapter` | Only the `IntegrationEvent` table exists | ERP integration deferred (P3) |
| Postgres 16 in compose | Postgres 17 | Matches the dev cluster |
| QA release allows a Minor open deviation with explicit acceptance | **Any** open deviation linked to the batch blocks release | Safer; exception handling can be added later through a controlled workflow |
| Recalls post-MVP | Mock-recall reconciliation and genealogy implemented. Real recall workflow and customer distribution register still deferred. | Research identified traceability as a high-value DRAP-readiness gap |

## Layering rules checked

- Controllers are thin, and the rules live in services. There is no generic "set status" endpoint. Status changes go through explicit actions, guarded by transition tables in `packages/types`.
- AI code only reads domain tables. Its writes are limited to its own tables and audit events.
- Regulated changes and their audit events share one transaction. A failed e-signature rolls everything back and is audited separately (tested).
