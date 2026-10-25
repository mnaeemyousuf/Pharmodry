# Unresolved Defects and Open Risks

As of 2026-10-18 **no known functional defect is open** in the implemented scope: all automated tests pass (113 Jest + 3 Playwright scenarios at last run, 2026-10-25). The items below are verification gaps, limitations and risks that remain. None of them are presented as fixed.

| ID | Type | Description | Impact | Recommended action |
|---|---|---|---|---|
| U-01 | Verification gap | Mistral provider never called with a real key | AI answer quality, latency and error handling with the live API are unknown | Test in a non-production tenant with a key (backlog O-01) |
| U-02 | Verification gap | Dockerfiles and compose never built or run | Container deployment may need fixes | Build and run on a Docker host (O-02) |
| U-03 | ~~Verification gap~~ **Closed 2026-10-25** | Material/supplier/spec/department create-edit, lot transfer/adjustment, risk analytics output, AI feedback and deviation assist are covered by `coverage-gaps.e2e-spec.ts`; the printable batch record by UI scenario 3 | — | — |
| U-04 | ~~Verification gap~~ **Closed 2026-10-25** | Negative test added: regulated-table fingerprints unchanged around all AI endpoints | — | — |
| U-05 | Limitation | Customer-level distribution is not captured; mock recall stops at "dispatched" quantities | A real recall needs ERP shipment data | Distribution register (O-07) |
| U-06 | Limitation | E-mail notifications are a logging stub | Users must check in-app notifications | SMTP/ACS channel (O-06) |
| U-07 | Limitation | No MFA/SSO; no idle timeout; password history/expiry not enforced | Weaker authentication than typical GMP expectations | O-04 |
| U-08 | Limitation | Uploads are not malware-scanned; local disk storage only | Risk if hostile files are uploaded; storage scaling | O-05 |
| U-09 | Limitation | Serialization is limited to GTIN/batch/expiry data readiness (no serial numbers, aggregation or regulator reporting) | DRAP S.R.O. 963(I)/2026 needs a full serialization solution | O-11 / partner L4 system |
| U-10 | Limitation | Pharmacovigilance, Sales/Distribution and Accountant roles do not exist | No manuals for these roles; out of scope | O-13 |
| U-11 | Risk | Performance targets not measured | Unknown behaviour at 100k lots/tenant | Load test (O-08) |
| U-12 | ~~Housekeeping~~ **Closed 2026-10-25** | Stray compiled files removed from `packages/validation/src` (package resolves through `dist/`); both apps type-check | — | — |
| U-13 | Housekeeping | Scratch databases from development (`seedrun1-3`, `p360_shadow`, `p360_e2e_1792279980989`, `p360_ui_1792280637768`, `pharma360_e2e`, the old `pharma360_dev`, and the WIN1252 databases `pharma360`/`pharma360_test`) remain on the local dev cluster | Disk use only | Drop them after the owner confirms they are not needed — not done without consent |
| U-14 | UI | API CSP permits `'unsafe-inline'` (Swagger UI) | Low | Nonce-based CSP, or serve Swagger only in non-production |
