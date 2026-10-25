# MVP Remediation Backlog

**Priorities:**

| Priority | Meaning |
|---|---|
| **P0** | Unsafe GMP behaviour, data-integrity breach or security hole |
| **P1** | MVP requirement broken or unverified on a critical path |
| **P2** | Important gap for pilot / production readiness |
| **P3** | Enhancement |

**Status:** ✅ done (verified by a test), 🟡 open.

## Done during the audit

| ID | P | Item | Verification |
|---|---|---|---|
| R-01 | P1 | Complete the missing API modules (production, eBMR, QA release, deviations, CAPA, analytics, scans, AI, attachments) | e2e A/B/X/M |
| R-02 | P1 | Build the web application (now 53 routes) | `next build`; Playwright UI1–UI3 |
| R-03 | P1 | Create executable tests for scenarios 1–4 | 35 unit + 78 API e2e + 3 UI scenarios |
| R-04 | P1 | eBMR corrections impossible (`newValue` stripped by whitelist) | X |
| R-05 | P1 | Deviation form failed silently without severity | UI2 |
| R-06 | P2 | Copilot intent mis-routing ("related" → delayed batches) | U |
| R-07 | P2 | "Deviations I own" ignored the owner filter | manual + UI |
| R-08 | P1 | Stock-out risk under-reported when plans exceed released stock | code review; rule corrected |
| R-09 | P0 | Session revoke button sent an unauthenticated request (revocation silently failed) | fixed to authenticated client |
| R-10 | P1 | Self password change left other sessions active | S (new test) |
| R-11 | P1 | Attachment download route shadowed — evidence files could not be retrieved | M (new test) |
| R-16 | P1 | Enforce `inventory.issue` for material issue (was `batch.reserve`) | S (new test) |
| R-17 | P1 | Configurable refresh-token rate limit (fixed 30/min per IP signed out users sharing an IP) | found by parallel capture; documented in .env.example |
| R-18 | P1 | Copilot page crash on answer render (effect returned a Promise) | UI3 (new regression check) |
| R-19 | P2 | Align menus/buttons with API permissions (traceability, PQR, batch-record QC section, GRN supplier filter) | capture-time API-error detection across all 19 roles |
| R-20 | P2 | Close PARTIAL test gaps (O-03), AI no-write negative test (O-09), remove stray compiled files (O-15) | `coverage-gaps.e2e-spec.ts`, UI3 |
| R-21 | P3 | Annotated screenshot copies with numbered callouts for key screens (master-prompt §11.2); research sources linked in the recommendations document; FDA link corrected | manuals build; link check 2026-10-25 |
| R-12 | P2 | Research-driven: traceability & mock recall | T, UI3 |
| R-13 | P2 | Research-driven: GS1 / GTIN data readiness (DRAP S.R.O. 963(I)/2026 DataMatrix) | U, T, M |
| R-14 | P2 | Research-driven: Product Quality Review data pack | T, UI3 |
| R-15 | P2 | Ops documentation, env examples, Docker files | files present (Docker unverified) |

## Open

| ID | P | Item | Notes |
|---|---|---|---|
| O-01 | P1 | Live verification of Mistral integration | Needs an API key; run copilot, deviation assist and CAPA draft in a non-production tenant |
| O-02 | P1 | Build and run the Docker images and compose stack | Docker unavailable here |
| O-04 | P2 | MFA and SSO (Entra ID / OIDC); idle-session timeout | Security hardening |
| O-05 | P2 | Malware scanning for uploads; object-storage driver (S3/Azure Blob) with encryption | |
| O-06 | P2 | E-mail notification channel (SMTP / Azure Communication Services) | Currently a logging stub |
| O-07 | P2 | Dispatch / distribution register (customer-level) | Needed for real recall depth; mock recall shows the gap explicitly |
| O-08 | P2 | Load/performance test against the p95 < 300 ms target | |
| O-10 | P2 | Backup/restore drill with audit-chain verification | |
| O-11 | P3 | Serialization: serial number allocation, aggregation, DRAP reporting interface | GS1 data readiness only today |
| O-12 | P3 | Change control, document control + Document Copilot, training records, complaints, stability, OOT | Roadmap R1–R11 in `docs/RESEARCH/ADDITIONAL_FEATURE_RECOMMENDATIONS.md` |
| O-13 | P3 | Pharmacovigilance, Sales/Distribution and Accountant roles | Not implemented; no manuals produced |
| O-14 | P3 | ERP adapters (SAP, Oracle, Business Central), import wizard | |
