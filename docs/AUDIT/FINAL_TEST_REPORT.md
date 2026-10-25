# Final Test Report

**Run date:** 2026-10-18 (all suites re-run after the last code change)

| Item | Value |
|---|---|
| Machine | Windows 11 Pro 10.0.26100 |
| Runtime | Node.js 24.20.0, npm 11.19.0 |
| Database | Embedded PostgreSQL 17.5 (UTF-8) |
| Browser | Microsoft Edge via Playwright 1.64.1 (`channel: msedge`) |
| Frameworks | Next.js 15.5.28, NestJS 11.2.7, Prisma 6.19.3, Jest 30.5.2 |

Every e2e and UI run creates a **new database**, applies all migrations, runs the full seed (including the five live scenarios through the real services) and drops the database afterwards. The tests therefore run against real PostgreSQL, real triggers and real transactions, with no mocks of the data layer.

## Summary

| Suite | Command | Result |
|---|---|---|
| Unit | `npm test` | **35 / 35 passed** |
| API e2e (Supertest) | `npm run test:e2e` | **78 / 78 passed** (7 suites) |
| UI e2e (Playwright, Edge) | `npm run test:ui` | **3 / 3 passed** (3.1 min) |
| Manual screenshot capture (Playwright, 19 roles + workflow) | `npm run manuals:capture` | **21 / 21 passed**, 745 screenshots, 0 capture failures, 0 API 403/5xx responses on any screen |
| Lint — API | `eslint src test prisma` | 0 errors, 0 warnings |
| Lint — web | `eslint .` | 0 errors, 0 warnings (one config warning fixed in this run) |
| Typecheck — API & web | `tsc --noEmit` | clean |
| Production builds | `npm run build` | API and web (53 routes) build successfully |

The combined Jest run reported `Tests: 113 passed, 113 total` across 7 suites (unit + API e2e).

## Required scenarios

| # | Scenario | Covered by | Result |
|---|---|---|---|
| 1 | Successful flow: PO → GRN → quarantine → QC → QA release → plan/batch → FEFO reservation → issue → eBMR → yield → FP QC → QA release → FG released → dashboards and audit trail | API `scenario-a` (11 tests); UI `scenario-1-success` | PASS |
| 2 | Failed QC: dissolution 74 % vs ≥ 80 % → OOS → release blocked → phases → deviation → root cause → CAPA → confirmed OOS → batch rejected | API `scenario-b` (9 tests); UI `scenario-2-oos` | PASS |
| 3 | Authorization & isolation: authentication, lockout, token rotation and reuse, password-change revocation, tenant isolation (records and search), RBAC denials, site scope, DB immutability, failed signature rollback, input validation, hash chain, headers | API `security` (20 tests) | PASS |
| 4 | Exceptions: expired material, suspended supplier, bad dates, shortage, missing QC results, expired calibration, segregation of duties, deviation → CAPA lifecycle, effectiveness failure, overdue notifications, AI degradation | API `exceptions` (13 tests) | PASS |

## Additional suites added during the audit

| Suite | Tests | Covers |
|---|---|---|
| `traceability.e2e-spec.ts` | 8 | Backward/forward genealogy, mock-recall reconciliation, audited CSV export and its permission, search, PQR figures, GTIN validation and uniqueness |
| `coverage-gaps.e2e-spec.ts` (2026-10-25) | 7 | Material, supplier, test-method/specification and department creation; lot transfer and adjustment through the ledger; risk-analytics content; AI feedback and deviation assist without a provider; **negative test: AI endpoints leave regulated records unchanged** |
| `administration.e2e-spec.ts` | 10 | Custom roles and permissions, sites/warehouses/bins, settings with reason and quarantine protection, product versioning, supplier qualification change, calibration, attachments (upload, disguised-file rejection, permission, download), production plans, notifications |
| UI `scenario-3-traceability` | 1 | Trace search → mock recall → backward genealogy → PQR page → Copilot answer renders without page errors |

## Defects found by the final round of testing

| Defect | Found by | Status |
|---|---|---|
| Attachment downloads always failed (route shadowing) | `administration` e2e | Fixed and re-tested |
| Self password change left other sessions active | Security review → new `security` test | Fixed and re-tested |
| `inventory.issue` permission not enforced (planners could issue materials) | Review while writing manuals → new `security` test | Fixed and re-tested |
| Copilot page crashed when an answer arrived | Screenshot capture | Fixed; regression check in UI scenario 3 |
| Token refresh limited to 30/min per IP (shared-IP users signed out) | Parallel screenshot capture | Made configurable (default 300) |
| Menus/buttons shown for screens whose API refused the role (traceability, PQR, batch-record QC section, GRN supplier filter) | Capture-time API-error detection | Aligned; final capture shows no 403s |
| Two e2e suites shared one product's GTIN state (test interdependence) | Full-suite run | Test made independent |

The full history of first-run failures is in `INITIAL_TEST_RESULTS.md`.

## Not tested

| Area | Reason |
|---|---|
| Live Mistral responses | No API key in the environment (BLOCKED) |
| Docker images / compose | Docker not installed (BLOCKED) |
| Performance (p95 target), load, soak | Not in scope of this run |
| Redis/BullMQ scheduling path | No Redis available; the in-process scheduler was exercised instead |
| Cross-browser (Firefox/Safari), mobile layouts | Only Edge automated |
| Backup / restore | Infrastructure-level |
| Paths marked PARTIAL in `REQUIREMENTS_COMPLIANCE_MATRIX.md` | No dedicated tests yet (backlog O-03) |

These results are developer verification. They are **not** validation evidence (see `docs/VALIDATION_NOTES.md`).

## 5. Post-rebrand verification (Pharma360 → Pharmodry, 2026-10-25)

| Check | Result |
|---|---|
| Unit + API e2e (`npx jest`) | **106 / 106 passed**. Includes 2 new compatibility tests: the legacy `p360_rt` cookie and `pharma360` CSRF header value still refresh, unknown values are rejected; tokens from the old JWT issuer stay valid, unknown issuers are rejected. |
| API lint and typecheck | clean |
| Web lint, typecheck and production build | clean |
| Browser scenarios 1–3 (Edge) | **3 / 3 passed** on the rebranded UI |
| Manual screenshot capture | **21 / 21 passed**, 745 fresh screenshots, 0 capture failures, 0 API errors |
| PDF manuals | 19 regenerated, 0 broken images |
| Database immutability after renaming the guard function | DELETE on `audit_events` still rejected |
| Demo accounts after password rotation | Login verified for both tenants |
| Residual-brand scan | Only the intentionally retained identifiers remain (see `docs/BRAND/REBRAND_REPORT.md` §3); none in web/API build output, generated manuals or the lockfile |

## 6. Audit follow-up run (2026-10-25)

| Check | Result |
|---|---|
| Unit + API e2e (`npx jest`) | **113 / 113 passed** (8 suites, incl. new `coverage-gaps`) |
| Browser scenarios (Edge) | **3 / 3 passed**; scenario 3 now also checks the printable batch record |
| Manual capture | **21 / 21 passed**, 745 screenshots + 4 annotated copies, 0 failures, 0 API errors |
| PDF manuals | 19 regenerated, 0 broken images |
| Research links | 31 / 41 reachable on 2026-10-25; one FDA link corrected; the rest are blocked/unavailable to automated clients (403/503/timeout), marked † in the recommendations sources |
