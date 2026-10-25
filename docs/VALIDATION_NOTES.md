# Pharmodry — Validation Notes

**Pharmodry is not a validated system.** It has not been qualified or validated for GMP use, and no regulator (DRAP, FDA, EMA or a PIC/S inspectorate) has assessed or approved it. The automated tests in this repository are developer verification. They are not IQ/OQ/PQ evidence. A regulated company adopting Pharmodry must validate it for its intended use under its own quality system.

This page lists what a validation effort would need, and which built-in controls and test assets can support it.

## Regulatory frame (see `docs/RESEARCH/REGULATORY_CONSIDERATIONS.md` for sources)

- **DRAP** adopted the PIC/S GMP Guide as the reference standard (S.R.O. 1587(I)/2025), with phased implementation in 2026.
- **PIC/S GMP Annex 11** (computerised systems) and **PIC/S PI 041-1** (data integrity).
- **WHO TRS 1033 Annex 4** (data integrity).
- **21 CFR Part 11** for US-market products.
- **GAMP 5 (2nd ed.)** risk-based approach, and FDA **Computer Software Assurance** guidance as a model for proportionate testing.

## Suggested approach

1. **Intended use and GxP assessment.** Decide which modules are used for GMP decisions (e.g. QA release, QC results, eBMR) and which are informational (dashboards, AI copilot). The AI features should be classified as *non-GxP decision support*. They do not create or change GMP records.
2. **Supplier assessment.** The tenant evaluates the vendor's development process, quality and support.
3. **User requirements (URS)** traced to configuration and tests. Begin from `docs/PRODUCT_REQUIREMENTS.md` and `docs/AUDIT/REQUIREMENTS_COMPLIANCE_MATRIX.md`.
4. **Risk assessment** (ICH Q9(R1)). High-risk functions get the deepest testing:
   - QA batch release blocking
   - quarantine and disposition of materials
   - OOS detection and handling
   - e-signatures
   - audit trail
   - access control
   - tenant isolation
   - inventory ledger
5. **Configuration specification.** Record tenant settings (yield tolerance, numbering, deviation due days, AI settings), roles and permissions, site scopes and specifications as approved configuration.
6. **Installation qualification.** Record the infrastructure, versions, image digests, migration list and environment variables (no secret values).
7. **Operational / performance qualification.** Run scripted tests in a controlled environment with approved data. The automated suites can be offered as supporting evidence, provided their execution is controlled (versioned scripts, recorded results, reviewed deviations).
8. **Data migration validation.** This applies when legacy data is imported. Seed history in the demo is labelled *migrated* only to illustrate the concept.
9. **SOPs and training.** Cover user management and periodic access review, audit-trail review, e-signature use, backup/restore, incident handling, change control, and AI-use guidance.
10. **Periodic review** and change control for every release.

## Built-in controls that support validation

| Expectation | Pharmodry control | Automated evidence (developer level) |
|---|---|---|
| Unique user identity, no shared accounts | Per-user accounts, lockout, sessions | `security.e2e-spec.ts` |
| Access control by role / site | Permission catalogue, site-scoped roles, server-side checks | `security.e2e-spec.ts`, scenario specs |
| Audit trail: who/what/when/why, old/new values, cannot be altered | Transactional audit events, DB append-only triggers, hash chain, `/audit/verify` | `security.e2e-spec.ts`, unit tests |
| E-signatures linked to records, with meaning, re-authentication | `ElectronicSignature` with password re-entry; failures audited | scenario A/B e2e |
| Sequencing of operations enforced | State machines; QA release blockers; quarantine on receipt; FEFO over released lots only | scenario A/B e2e, `exceptions.e2e-spec.ts`, Playwright UI scenarios |
| Data accuracy checks | DTO validation, specification evaluation, yield calculation, GTIN check digits | unit tests |
| Corrections without obscuring the original | `BatchStepCorrection` and result versions with a reason | `exceptions.e2e-spec.ts` |
| Copies of records for inspection | Printable eBMR record, CSV exports (audited), audit-trail export | manual / UI |
| Backup and restore | Infrastructure responsibility | **not tested** |

## Known gaps relevant to validation

See `docs/AUDIT/UNRESOLVED_DEFECTS.md` and `docs/DEMO/KNOWN_LIMITATIONS.md`. In particular:

- no MFA/SSO
- no document control or training records
- no change-control module
- no stability module
- no instrument/LIMS interfaces
- the dispatch / customer distribution register is not captured (this limits recall depth)
- no serial-number (aggregation) management — only GTIN/batch/expiry data readiness
- no load testing
- containers not build-verified
- Mistral integration not tested with a live key
