# Pharmodry — Final Delivery Report

> **Rebrand (2026-10-24/25):** the product formerly named Pharma360 is now **Pharmodry** — *Precision in Every Batch.* See `docs/BRAND/BRAND_GUIDELINES.md` (logo, colours, typography) and `docs/BRAND/REBRAND_REPORT.md` (changes, compatibility, retained identifiers). The demo password default is now `Pharmodry!Demo26`.

**Date:** 2026-10-18
**Scope:** build of the Pharmodry MVP and the subsequent audit, gap analysis, industry research, MVP completion, documentation and role-based PDF manuals.

**Status:** an MVP for demonstration and pilot evaluation, using fictional data. It is **not validated** for GMP use and **not approved** by any regulator.

## 1. What was already working (at audit start)

The audit request arrived while the platform was still being built (`docs/AUDIT/INITIAL_PROJECT_ASSESSMENT.md`). These parts existed and compiled:

- the monorepo and shared packages
- the Prisma schema with database-level immutability and CHECK constraints
- auth (JWT + rotating refresh tokens, lockout), tenant scoping, the hash-chained audit trail and e-signatures
- organisations, users/roles, versioned master data, suppliers, procurement, goods receipt, inventory ledger, QC sampling/results and OOS

Nothing had yet been executed end to end, and no automated tests existed.

## 2. What was broken or missing

**Missing:**

- production plans, batches/eBMR, QA release, deviations, CAPA
- analytics, Command Center, search, scheduled scans
- AI, attachments
- seed and demo data
- the entire web UI
- all tests and all operational documentation

**Defects found by the new tests and reviews (all fixed; details in `docs/AUDIT/INITIAL_TEST_RESULTS.md`):**

| Defect | Effect before the fix |
|---|---|
| eBMR correction value stripped by validation | Corrections were impossible |
| Deviation form failed silently | Deviations without a severity could not be raised, and no error was shown |
| Copilot intent mis-routing | "related" was matched as "late" |
| Owner filter ignored | "Deviations I own" listed everything |
| Profile session revoke sent no token | Revocation silently failed |
| Stock-out risk rule | Risk under-reported when plans exceeded released stock |
| Self password change | Other sessions stayed signed in |
| Attachment download route shadowed | Evidence files could not be downloaded |
| `inventory.issue` not enforced | Planners and supervisors could issue stock |
| Token-refresh limit fixed at 30/min per IP | Users sharing an office IP would be signed out |
| Menus shown without the matching API permission | Traceability (stuck loading), PQR, batch-record QC section and GRN supplier filter were refused for some roles. The server blocked access correctly, but the pages appeared broken |
| Copilot page crash | The page crashed whenever an answer arrived (current Edge returns a Promise from `scrollIntoView`, and an effect returned it) |

## 3. What was implemented

- **API:** 20 NestJS modules (~150 endpoints, Swagger at `/api/docs`). GMP rules are enforced on the server:
  - quarantine on receipt; FEFO over released lots only
  - QA release blocked by pending or failed QC, open or confirmed OOS, open deviations, unverified eBMR steps and unjustified yield
  - segregation of duties; e-signatures with re-authentication
  - append-only records; versioned master data
- **Web:** Next.js app with 53 routes:
  - role-aware My work
  - Command Center and dashboard (with table views)
  - procurement, receipts, inventory with risk and expiry views
  - plans, batches/eBMR with a printable batch record
  - QC, OOS, deviations, CAPA
  - traceability, PQR
  - master data, audit trail, reports, administration, Copilot
- **Data:** two tenants (data isolation is tested), 22 demo users, six months of history labelled as migrated, and five live scenarios executed through the real services.
- **AI:** Mistral provider behind an `LLMProvider` interface, server-side only. Deterministic intent detection plus controlled, permission-checked retrieval, prompt sanitisation, citations, feedback and retention. Copilot, deviation-investigation assistant and CAPA drafting are advisory only.
- **Infrastructure:**
  - embedded PostgreSQL launcher
  - isolated test-environment runner
  - Dockerfiles and compose (unverified)
  - `.env.example` files

## 4. Industry research and features added

Research with sources is in `docs/RESEARCH/`. It covers:

- DRAP's adoption of the PIC/S GMP Guide (S.R.O. 1587(I)/2025) with phased 2026 implementation
- S.R.O. 963(I)/2026 2D DataMatrix requirements
- PIC/S PI 041-1, WHO TRS 1033 Annex 4, FDA Part 11 / OOS guidance, ICH Q9(R1)
- competitors (Veeva, TrackWise Digital, MasterControl, SAP, LabWare/LabVantage)

Three high-value gaps were implemented and tested:

1. **Batch genealogy and mock recall** — backward/forward trace and a reconciliation report with an audited CSV export.
2. **GS1/serialization data readiness** — GTIN master data with check-digit validation, the (01)(17)(10) element string on batches and batch records, and Command Center readiness gaps.
3. **Product Quality Review data pack.**

Roadmap items R1–R11 are listed in `docs/RESEARCH/ADDITIONAL_FEATURE_RECOMMENDATIONS.md`.

## 5. What was tested

| Suite | Content |
|---|---|
| Unit | 35 tests: specification evaluation, yield, numbering, state machines, status parity, audit hashing, authorization principal, tenant extension, AI sanitiser and intents, CSV safety, GS1 helpers |
| API e2e (real PostgreSQL, fresh database per run) | 78 tests: scenario A (success), scenario B (failed QC/OOS), security & isolation, exceptions, traceability/PQR/GTIN, administration/master data, coverage gaps (master-data CRUD, lot movements, risk analytics, AI no-write)/attachments/planning |
| Browser (Playwright, Microsoft Edge) | 3 scenarios: success path, OOS path, traceability/PQR/Copilot |
| Role tours | 19 roles × every permitted screen during manual capture; any 403/5xx would be flagged (none at the final run) |
| Static checks | ESLint and TypeScript for API and web; production builds |

## 6. What passed

All of it at the last run:

- Unit + API e2e: **113/113** (`Tests: 113 passed, 113 total`)
- Browser: **3/3**
- Manual capture: **21/21**, 745 screenshots, no API errors
- Lint and typecheck: clean

Evidence is in `docs/AUDIT/FINAL_TEST_REPORT.md`. Requirement-level evidence is in `docs/AUDIT/REQUIREMENTS_COMPLIANCE_MATRIX.md`.

## 7. What failed or remains blocked

| Item | Status | Reason |
|---|---|---|
| Live Mistral AI calls | BLOCKED | No API key in the environment. Fallback paths are tested. |
| Docker images / compose | BLOCKED | Docker not installed |
| Performance (p95 target), load, Redis/BullMQ path, other browsers, backup/restore | Not tested | — |
| Remaining PARTIAL rows | PARTIAL | Live AI (blocked), e-mail channel (deferred), time-zone display and visual regression not automated — see the matrix |

## 8. MVP acceptance criteria

- **Met:** the 25 MVP capabilities and 12 critical GMP rules, as verified by executed tests. Rules 10–11 (AI cannot decide or alter records) are PASS for behaviour, but the absence of AI write paths is verified by code inspection only.
- **Partially met:** notifications' e-mail channel (stub) and live Copilot/AI drafting (no API key). Master-data CRUD, departments, lot movements, risk analytics and the AI no-write guarantee are now tested (2026-10-25).
- **Not met:** the non-functional p95 performance target (not measured).

The MVP is therefore **accepted for demonstration and pilot evaluation**, not for production GMP use.

## 9. Safe to demonstrate

- Scenarios A–E; the Command Center and dashboard; QC → OOS → deviation → CAPA
- QA release blocking and e-signatures
- Audit-trail verification; tenant isolation; role-restricted screens
- Traceability and mock recall; PQR; GTIN validation
- Copilot in fallback mode (labelled "AI provider not configured")

Use `docs/DEMO/DEMO_WALKTHROUGH.md`.

## 10. Requires further work before a real customer deployment

1. Computerised-system validation by the customer.
2. MFA/SSO.
3. Malware scanning and object storage.
4. E-mail notifications.
5. Distribution register for real recalls.
6. Full serialization (serial numbers, aggregation, DRAP reporting) through a partner.
7. Document control, training and change control.
8. Container build verification and load testing.
9. Live AI evaluation.
10. Backup/restore drills.
11. An independent penetration test.

See `docs/AUDIT/MVP_REMEDIATION_BACKLOG.md`.

## 11. PDF manuals generated

<!--PDF-LIST-->
19 role-specific manuals were generated on 2026-10-18 from 745 genuine screenshots of the running application (capture failures: 0; API errors during capture: 0). Each manual has a cover, a clickable table of contents, 20 chapters covering all 27 mandatory items, page numbers, headers/footers and numbered figures. Broken images: 0.

| # | Role | Pages | Figures |
|---|---|---|---|
| 01 | Super Admin | 95 | 92 |
| 02 | Company Admin | 62 | 52 |
| 03 | Plant Manager | 58 | 48 |
| 04 | Production Manager | 69 | 61 |
| 05 | Production Supervisor | 57 | 47 |
| 06 | Production Operator | 40 | 26 |
| 07 | QA Manager | 71 | 64 |
| 08 | QA Officer | 63 | 55 |
| 09 | QC Manager | 57 | 48 |
| 10 | QC Analyst | 51 | 40 |
| 11 | Warehouse Manager | 54 | 42 |
| 12 | Warehouse Officer | 52 | 40 |
| 13 | Procurement Manager | 40 | 30 |
| 14 | Procurement Officer | 37 | 26 |
| 15 | Supply Chain Planner | 51 | 41 |
| 16 | Engineering / Maintenance | 38 | 24 |
| 17 | Regulatory Affairs Officer | 39 | 24 |
| 21 | Auditor | 56 | 47 |
| 22 | Management Viewer | 54 | 44 |

Not generated (roles not implemented, marked deferred): Pharmacovigilance Officer, Sales / Distribution User, Accountant.

Supporting files:

- `docs/USER_MANUALS/ROLE_AND_PERMISSION_CATALOG.md`
- `docs/USER_MANUALS/SCREENSHOT_INVENTORY.md`
- `docs/USER_MANUALS/GENERATION_GUIDE.md`
- `docs/USER_MANUALS/SOURCES/`
- `docs/USER_MANUALS/MANUAL_SOURCES/`
- `docs/USER_MANUALS/SCREENSHOTS/`

## 12. Exact relative paths of the PDFs

<!--PDF-PATHS-->
- `docs/USER_MANUALS/PDF/01_Super_Admin_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/02_Company_Admin_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/03_Plant_Manager_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/04_Production_Manager_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/05_Production_Supervisor_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/06_Production_Operator_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/07_QA_Manager_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/08_QA_Officer_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/09_QC_Manager_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/10_QC_Analyst_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/11_Warehouse_Manager_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/12_Warehouse_Officer_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/13_Procurement_Manager_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/14_Procurement_Officer_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/15_Supply_Chain_Planner_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/16_Engineering_Maintenance_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/17_Regulatory_Affairs_Officer_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/21_Auditor_User_Manual.pdf`
- `docs/USER_MANUALS/PDF/22_Management_Viewer_User_Manual.pdf`

## 13. How to run the application

Run from the repository root.

1. Install dependencies:

```bash
npm install
```

2. Build the shared packages:

```bash
npm run build:packages
```

3. Start PostgreSQL in its own terminal. This is the embedded PostgreSQL 17 on port 5433:

```bash
npm run db:start
```

4. Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`, then apply the migrations:

```bash
npm run db:migrate
```

5. Load the demo data (skip this if the target database is already seeded):

```bash
npm run db:seed
```

6. Start the API on http://localhost:4100 (Swagger at `/api/docs`):

```bash
npm run dev:api
```

7. Start the web app on http://localhost:3000:

```bash
npm run dev:web
```

Production mode uses `npm run build`, then `npm run start -w @pharmodry/api` and `npm run start -w @pharmodry/web`. Tests: `npm test`, `npm run test:e2e`, `npm run test:ui` (each e2e/UI run uses its own throwaway database). Demo log-ins are listed in `docs/DEMO/DEMO_DATA_GUIDE.md`.

## 14. Seeding and resetting demo data safely

- The seed loads fictional data only. It refuses to run when `NODE_ENV=production` (unless `ALLOW_DEMO_SEED=true`), and it refuses to reseed a database that already contains the demo tenant.
- **To start fresh without destroying anything:** create a new UTF-8 database, run `prisma migrate deploy` and `npm run db:seed` against it with `DATABASE_URL` overridden, then point `apps/api/.env` at it. The commands are in `docs/DATABASE.md`. This is how `pharma360_demo` was created during this delivery; the older `pharma360_dev` was left intact.
- `npm run db:reset` wipes the target database. Use it only on a disposable local database. It was **not** run during this delivery.

## 15. Configuring the Mistral API

Set these in `apps/api/.env` (server side only; never in the web app):

```bash
MISTRAL_API_KEY=<your key>
MISTRAL_MODEL=mistral-small-latest
MISTRAL_BASE_URL=https://api.mistral.ai/v1
```

Restart the API. **Admin → AI governance** then shows the provider as configured. AI can be switched off per tenant, and the retention period changed, under **Admin → Organisation → Policies**. Details are in `docs/AI_ARCHITECTURE.md`.

## 16. Recommended next steps

1. Run the AI features with a real key and review answer quality.
2. Build and run the containers; deploy a staging environment.
3. ~~Close the PARTIAL test gaps and add a negative AI write-path test~~ — done 2026-10-25 (`coverage-gaps.e2e-spec.ts`).
4. Implement MFA/SSO and malware scanning.
5. Prioritise DRAP-driven roadmap items: document control / Site Master File (R1) and a serialization partner integration (R2).
6. Plan CSV/CSA validation with a pilot customer: URS, risk assessment, IQ/OQ/PQ, SOPs.
7. Run load tests against the p95 target.
8. With the owner's consent, clean up the scratch databases listed in `UNRESOLVED_DEFECTS.md` U-13.
