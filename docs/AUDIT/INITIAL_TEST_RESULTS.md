# Initial Test Results

At audit start **no automated tests existed** (see `INITIAL_PROJECT_ASSESSMENT.md`). The results below are the **first executions** of each suite after it was written, with timestamps from the session log. They are reported as observed, including failures. Final results are in `FINAL_TEST_REPORT.md`.

Environment: Windows 11 Pro, Node 24.20, embedded PostgreSQL 17.5, Microsoft Edge (Playwright channel `msedge`).

## 1. Unit tests — first run 2026-10-17 23:24 UTC

**31 tests: 29 passed, 2 failed.**

| Failure | Root cause | Classification | Fix |
|---|---|---|---|
| Copilot intent "related deviations" was classified as *delayed batches* | Regex `/late/` matched inside "re**late**d" | **Product defect** | Word-boundary regex `\b(delay\w*|late|behind schedule|overdue batch(es)?)\b` |
| Tenant-scope extension test could not reach the handler | `Prisma.defineExtension` returns a function, not the config object | Test design | Exported `tenantScopeHandler` and tested it directly |

All 31 tests passed at 23:26 UTC.

## 2. API e2e (Supertest, real PostgreSQL) — first run 2026-10-17 23:32 UTC

**49 tests: 35 passed, 14 failed.**

| Failure group | Root cause | Classification | Fix |
|---|---|---|---|
| Several tests timed out | Jest ignores `testTimeout` set per project | Test config | Moved `testTimeout` to the root config |
| Query error in a test | Test used a `tenant` relation that `Batch` does not expose | Test code | Filter by `tenantId` |
| FEFO assertion | Test assumed a specific lot; seed data made another lot equally valid | Test assumption | Assert the FEFO invariant (no released, unexpired lot with an earlier expiry was skipped) |
| **eBMR correction rejected (400)** | `CorrectStepDto.newValue` had no class-validator decorator, so the global whitelist stripped it. Corrections were impossible. | **Product defect** | `@IsDefined()` on `newValue` |
| Deviation closure rejected | Test closing text shorter than the 10-character minimum | Test data | Longer text |
| CAPA submit expected 400 | Business-rule violation correctly returns 422 | Test expectation | Expect 422 |

All 49 tests passed at 23:38 UTC.

## 3. Playwright UI scenarios — first runs 2026-10-17 23:54 → 2026-10-18 00:03 UTC

Scenario 1 (success path) and Scenario 2 (OOS) failed on the first attempts, then passed (2 passed, 2.7 min) at 00:03 UTC.

| Failure | Root cause | Classification | Fix |
|---|---|---|---|
| Wrong URL captured after creating records | `page.url()` read before navigation finished | Test code | `waitForURL` with glob patterns |
| Finished-goods lot not found | Ambiguous locator | Test code | Added `data-testid="fg-lot"` |
| **Deviation form did nothing on submit** | An empty `proposedSeverity` (`''`) failed Zod validation, and the form showed no error. Users could not raise a deviation without choosing a severity, and got no explanation. | **Product defect** | Schema accepts empty/optional; form now displays validation errors; local-time default for "occurred at" |
| OOS phase text not yet updated | Race between mutation and refetch | Test code | Wait for the status change |
| Test DB could not be dropped | `DROP DATABASE` sent in one multi-statement batch (implicit transaction) | Test harness | Separate statements |
| Planner "issue materials" assertion | Test expected a button the planner is correctly not allowed to see | Test expectation | Corrected assertion (warehouse issues) |

## 4. Defects found outside test runs (code review during the audit)

| Defect | Fix |
|---|---|
| Deviations list ignored the `ownerId` filter ("Deviations I own" showed everything) | Filter implemented |
| Profile "revoke session" used a raw `fetch` without the bearer token | Added an authenticated `api.del` |
| Stock-out risk not HIGH when planned batches need more than released stock | Rule corrected |
| Seed: special lots inserted after the ledger insert, losing their transactions | Reordered |
| Self-service password change did not revoke other sessions | Now revokes all other session families (e2e test added) |
| Material issue not restricted to warehouse roles (`inventory.issue` unused) | Enforced in API and UI; e2e test added |
| Token-refresh rate limit fixed at 30/min per IP (shared-IP users signed out) | Made configurable, default 300 (`REFRESH_RATE_LIMIT_PER_MINUTE`) |
| **Copilot page crashed when an answer arrived** (“Application error”) — an effect returned the value of `scrollIntoView`, which current Edge/Chromium returns as a Promise; React treated it as a cleanup function | Effect body wrapped in braces; browser regression check added to UI scenario 3 (found during screenshot capture) |
| Screens visible to roles whose API calls are refused (traceability, PQR, batch-record QC section, GRN supplier filter) | Permissions aligned; capture now flags any 403/5xx per screen |
| **Attachment download route was shadowed** — `GET /attachments/file/:id` matched `GET /attachments/:entityType/:entityId`, so downloads always failed with 400 | Route order fixed (found by the new administration e2e test on 2026-10-18) |
