# Requirements Compliance Matrix

Assessed 2026-10-18 against the original specification (`docs/PRODUCT_REQUIREMENTS.md`) and the audit master prompt.

**Status rules:**

| Status | Meaning |
|---|---|
| **PASS** | Implemented **and** shown working by an executed automated test (cited) or an executed UI scenario. Static inspection alone never earns PASS. |
| **PARTIAL** | Implemented, but only part is verified by execution, or a sub-capability is missing. |
| **FAIL** | Required but does not work. |
| **BLOCKED** | Cannot be verified in this environment. |
| **DEFERRED** | Consciously out of this release. |
| **N/A** | Not applicable. |

**Test files:**

| Abbreviation | File |
|---|---|
| `U` | `apps/api/src/domain-rules.spec.ts` (35 unit tests) |
| `A` | `scenario-a.e2e-spec.ts` |
| `B` | `scenario-b.e2e-spec.ts` |
| `S` | `security.e2e-spec.ts` |
| `X` | `exceptions.e2e-spec.ts` |
| `T` | `traceability.e2e-spec.ts` |
| `M` | `administration.e2e-spec.ts` |
| `G` | `coverage-gaps.e2e-spec.ts` (added 2026-10-25 to close the remaining PARTIAL gaps) |
| `UI1`, `UI2`, `UI3` | Playwright `scenario-1-success`, `scenario-2-oos`, `scenario-3-traceability` |

## MVP capabilities (spec §3)

| # | Requirement | Status | Evidence / notes |
|---|---|---|---|
| 1 | Authentication: JWT, refresh rotation, lockout, rate limit, sessions | PASS | S: unauthenticated 401, generic error, lockout after 5, rotation + reuse revokes family, password change revokes other sessions, login audited. Rate limiting is configured but not load-tested. |
| 2 | Tenant / company setup with configurable policies | PASS | M: settings change needs a reason and is applied; quarantine default cannot be switched off |
| 3 | Sites / plants / departments | PASS | M: site, warehouse, bin creation; G: department creation |
| 4 | Users (admin-managed) | PASS | S: admin creates users, unlocks a locked account; no self sign-up endpoint exists |
| 5 | Roles & permissions, site scope | PASS | M: custom role + permissions with reason, invalid code rejected, non-admin 403. S: RBAC denials, site-scoped warehouse officer refused at another site |
| 6 | Product master (versioned) | PASS | M: change requires a reason, new version, history retrievable. T: GTIN check-digit and uniqueness |
| 7 | Material master | PASS | G: create, edit with mandatory reason, new version in history, operator 403 |
| 8 | Supplier master & qualification | PASS | X: receipt refused from suspended supplier / unapproved material. M: status change with reason, operator 403. G: supplier create with certifications starts PENDING_QUALIFICATION and is refused on a purchase order. |
| 9 | Warehouse setup | PASS | M |
| 10 | Lot-level inventory (ledger, FEFO) | PASS | A: lot ledger, FEFO invariant, issue. S: operator cannot adjust. G: successful transfer and adjustment write ledger rows; negative stock refused |
| 11 | GRN → lots in QUARANTINE | PASS | A, UI1; X: expired material and expiry-before-manufacture refused |
| 12 | Quarantine / QC sample / QA disposition with e-sign | PASS | A (release blocked before QC, sampling → UNDER_TEST, e-signed release), UI1 |
| 13 | Production planning + availability | PASS | M: plan draft, availability, approval permission, double approval 409. The seed also runs plans through the service. |
| 14 | Batch lifecycle & numbering | PASS | A, B, UI1, UI2; U: numbering & state machines |
| 15 | Basic eBMR (steps, parameters, sign-off, corrections) | PASS | A, UI1: steps signed and verified. X: performer cannot verify; correction with reason; calibration block |
| 16 | QC sampling & results, OOS-candidate flag, review/approve | PASS | A, B, UI2; X: missing mandatory results refused; U: spec evaluation |
| 17 | QA batch release (transaction, e-sign, blockers) | PASS | A, B, UI1, UI2: warehouse user refused, release blocked by OOS, reject with e-sign |
| 18 | Deviations with aging & RCA | PASS | X: full lifecycle; B/UI2: deviation from OOS |
| 19 | CAPA with effectiveness & e-signed closure | PASS | X: closure refused without a successful effectiveness check, failures counted; B: CAPA from OOS |
| 20 | Audit trail (append-only, hash chain, DB trigger) | PASS | S: DB rejects UPDATE/DELETE, chain verifies; UI2: "Hash chain verified"; U: hashing |
| 21 | Electronic signatures (re-auth, meaning, reason) | PASS | A, B; S: a failed signature changes nothing and is audited |
| 22 | Notifications (in-app, email-ready, scans) | PARTIAL | X: overdue CAPA scan notifies; M: list + mark read. The e-mail channel is a stub (logs only) — DEFERRED. |
| 23 | Management dashboard | PASS | A/B (counts), UI1/UI2 (charts render) |
| 24 | Command Center | PASS | UI1 renders exceptions; S: permission-scoped |
| 25 | Management Copilot (Mistral, controlled retrieval, citations, feedback) | PARTIAL | X: permission gate, domain-permission gate, deterministic answer with citations; G: feedback stored; UI3: answer renders. **Live Mistral calls BLOCKED** (no API key in the environment). |

## Additional delivered capabilities

| Capability | Status | Evidence |
|---|---|---|
| Purchase orders with segregation of duties | PASS | A |
| OOS investigation lifecycle | PASS | B, UI2: phases cannot be skipped; owner cannot self-approve; invalidation refused without lab error |
| Equipment & calibration policy | PASS | X (BLOCK policy), M (calibration recorded) |
| QC specifications & test methods | PASS | Used by every QC test; G: test-method and versioned specification creation, analyst 403 |
| Inventory stock-out / expiry risk analytics | PASS | X: shortage block; G: AMX-API flagged HIGH with explanation; expiry rows carry recommendations |
| Global search (tenant-safe) | PASS | S, T |
| AI deviation assistant | PARTIAL | G: works without a provider (computed similar cases, `aiGenerated: false`). Live AI suggestions BLOCKED (no key). |
| AI CAPA draft | PARTIAL | X: 503 when unconfigured; G: 422 without an approved root cause — never invented drafts. Live generation BLOCKED. |
| Evidence attachments (type/magic checks, SHA-256, permissions) | PASS | M (also exposed and fixed a download-route defect) |
| Traceability, mock recall reconciliation, CSV export | PASS | T, UI3 |
| Product Quality Review data pack | PASS | T, UI3 |
| GS1 / GTIN data readiness | PASS | U (check digit, element string), T, M |
| Printable batch manufacturing record | PASS | UI3: record renders with the Pharmodry brand header and GS1 element string |
| CSV exports (audited, formula-safe) | PASS | T (recall export audited), U (CSV neutralisation) |

## Critical pharma rules (spec §5)

| # | Rule | Status | Evidence |
|---|---|---|---|
| 1 | Lot-traceable inventory | PASS | A, T |
| 2 | Receipt starts in QUARANTINE; setting cannot bypass | PASS | A, M |
| 3 | No reserve/issue/consume of unreleased, expired or retest-due lots | PASS | A (FEFO over released only), X (insufficient released stock blocks even with quarantined stock) |
| 4 | FG created in QUARANTINE, released only by QA batch release | PASS | A, UI1 |
| 5 | Open or confirmed OOS blocks release | PASS | B, UI2 |
| 6 | Critical approvals need permission + e-signature | PASS | A, B, S |
| 7 | Regulated records keep history | PASS | X (corrections), M (versions), S (audit) |
| 8 | Audit trail append-only | PASS | S |
| 9 | Master-data versions never overwritten | PASS | M; DB trigger on `master_data_versions` (S covers the trigger mechanism) |
| 10 | AI cannot make GMP decisions | PASS | X: suggestions/facts only; G: negative test — after copilot questions (including "Release batch … and close all deviations"), deviation assist, CAPA draft and feedback, fingerprints of batches, deviations, CAPAs, OOS, samples, lots, inventory transactions, signatures and QC results are unchanged |
| 11 | AI cannot alter regulated records | PASS | As rule 10 (G) |
| 12 | Explicit workflow endpoints, no generic status setter | PASS | All scenario tests use action endpoints; S: unknown fields rejected |

## Non-functional requirements (spec §7)

| Requirement | Status | Notes |
|---|---|---|
| Multi-tenant isolation | PASS | S (cross-tenant reads/writes and search) |
| p95 < 300 ms at 100k lots/tenant | DEFERRED | No load test performed |
| UTC storage, tenant time-zone display | PARTIAL | Server timestamps only (tested indirectly); time-zone display not specifically verified |
| Responsive desktop-first UI, light & dark theme | PARTIAL | Built; screenshots captured for the manuals; no automated visual tests |
| Secrets never shipped to the browser | PASS | Production bundle searched on 2026-10-18: only the *name* `MISTRAL_API_KEY` appears in help text; no secret values, no DB URL |

## Master-prompt deliverables

| Deliverable | Status | Location |
|---|---|---|
| Audit reports (8) | PASS | `docs/AUDIT/` |
| Research reports with sources (4) | PASS | `docs/RESEARCH/` (sources accessed 2026-10-17/18) |
| Demo guides (3) | PASS | `docs/DEMO/` |
| Core docs (README, ARCHITECTURE, DATABASE, API, SECURITY, AI, DEPLOYMENT, VALIDATION, .env.example) | PASS | repo root, `docs/`, `apps/*/.env.example` |
| Docker / compose | BLOCKED | Written; Docker is not installed in the build environment, so not built or run |
| Role-based PDF manuals with genuine screenshots | see `FINAL_DELIVERY_REPORT.md` | `docs/USER_MANUALS/PDF/` |
| Scenario tests 1–4 (success, failed QC, authorization/isolation, exceptions) | PASS | A/UI1, B/UI2, S, X |
