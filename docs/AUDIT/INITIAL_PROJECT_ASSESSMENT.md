# Initial Project Assessment

**Audit trigger:** master prompt *"Complete system audit, gap analysis, industry research, MVP completion & role-based PDF user manuals"*, received 2026-10-17 11:46 UTC.
**Assessor:** Claude (AI coding agent), working in the repository `C:\Users\HS LAPTOP\Documents\MediERP`.

## Important context

The audit request arrived **while the system was still being built** in the same engagement. There was no separate legacy codebase to audit. This report records the state of the project at that moment, as reconstructed from the working session log and the files on disk. It does not present a hypothetical "before" picture.

## State at audit start (2026-10-17 11:46 UTC)

| Area | State | Evidence |
|---|---|---|
| Requirements & design | `docs/PRODUCT_REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_BACKLOG.md` written | files on disk |
| Monorepo & shared packages | npm workspaces. `packages/types` (statuses, permissions, default roles, settings, spec evaluation), `validation` (Zod), `ui` (status tones), `config`. Compiled cleanly. | compile run in session |
| Database | Prisma schema covering all MVP entities. Migrations `init` + `compliance_controls` (append-only triggers, CHECK constraints). Embedded PostgreSQL launcher. | `apps/api/prisma` |
| API — written and compiling | bootstrap (Helmet, CORS, validation, envelope, Swagger), CLS context, tenant-scope Prisma extension, audit (hash chain), e-signatures, auth (login/refresh rotation/lockout), organisations, users/roles, master data (versioned), suppliers, procurement, goods receipt, inventory ledger, QC sampling/results, OOS | session log: "Clean compile" before the QC/OOS module |
| API — not yet written | production plans, batches & QA release, eBMR, deviations, CAPA, analytics/Command Center, search, scheduled scans, notifications wiring, AI, attachments, health | — |
| Seed / demo data | none | — |
| Web application | none (no pages) | — |
| Automated tests | **none existed** | — |
| Ops docs (README, DATABASE, API, SECURITY, AI, DEPLOYMENT, VALIDATION) | none | — |
| Docker / env examples | none | — |
| Research, audit, demo, manuals | none | — |

## Assessment

- **Architecture direction: sound.** It is a modular monolith with server-side rule enforcement, database-level immutability, permission-code RBAC with site scope, and tenant isolation in depth. This matches the stated GMP rules, and no redesign was needed.
- **Main risk: completeness, not design.** More than half of the MVP (production, quality events, analytics, AI and the entire UI) did not exist, and nothing had been executed end to end.
- **Verification risk.** With no tests, every requirement could only be "statically inspected". Under the audit rules, a requirement cannot be marked PASS on static inspection alone. So the plan was: complete the build, then write executable tests for the four required scenarios, then grade requirements only on executed evidence.

## Resulting plan (as executed)

1. Finish the API modules, then the seed (master data, six months of migrated-labelled history, live scenarios run through the real services).
2. Build the web application (51 routes at the time).
3. Write unit tests, API e2e tests (scenarios A/B, security/isolation, exceptions) and Playwright UI scenarios. Fix every real defect they expose (see `INITIAL_TEST_RESULTS.md`).
4. Industry and regulatory research with sources (`docs/RESEARCH/`). Implement the highest-value research-driven gaps: traceability/mock recall, GS1 data readiness, PQR data pack.
5. Documentation, audit reports, demo guides, role manuals with genuine screenshots, and the final delivery report.

## Environment notes discovered during assessment

- Port **4000** is used by another application on this machine (an "HMS" app). Pharmodry's API default was moved to **4100**, and the other app was left untouched.
- The initial embedded cluster created databases in WIN1252 encoding, which broke on `≤` and `°`. UTF-8 databases were created with `TEMPLATE template0`. The WIN1252 databases were left in place, not dropped.
- `prisma migrate reset` was blocked by a safety guard that requires explicit user consent. The audit did **not** bypass this. Fresh databases were created instead.
