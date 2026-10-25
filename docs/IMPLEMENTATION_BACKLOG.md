# Implementation Backlog

> Updated 2026-10-18 after the audit. Detailed status with test evidence: `docs/AUDIT/REQUIREMENTS_COMPLIANCE_MATRIX.md`; open items: `docs/AUDIT/MVP_REMEDIATION_BACKLOG.md`.

Legend: ✅ done in MVP · 🟡 partial / architected · ⬜ later

## Epic 0 — Foundation
- ✅ Monorepo (npm workspaces), strict TS, ESLint, shared packages
- ✅ Embedded Postgres dev launcher
- 🟡 docker-compose (Postgres + Redis) and Dockerfiles — written, not build-verified
- ✅ Prisma schema + migrations + DB-level audit immutability trigger
- ✅ Structured logging (pino-style JSON via Nest logger), correlation ids
- ✅ Standard response envelope, pagination/sort/filter helpers, error filter, Swagger at `/api/docs`

## Epic 1 — Identity, tenancy, RBAC
- ✅ Login, refresh rotation with reuse detection, logout, session list/revoke
- ✅ Lockout (5 attempts / 15 min), throttling
- ✅ Tenants, sites, departments, warehouses, bins
- ✅ Users, roles, permissions, site-scoped role assignments
- ⬜ Entra ID / OIDC SSO, MFA

## Epic 2 — Master data
- ✅ Products, materials, suppliers (+ approved materials), UoM, categories, dosage forms
- ✅ BOMs, routings (eBMR templates), equipment, QC specs, test methods
- ✅ Versioned snapshots of regulated master data
- ⬜ Import wizard (upload → map → validate → preview → confirm)

## Epic 3 — Procurement & inventory
- ✅ Purchase orders (create/approve), GRN with lot creation in QUARANTINE
- ✅ Lot ledger, transfer, adjustment (reason + permission), FEFO reservation, issue
- ✅ Expiry / safety-stock scans and alerts
- ⬜ PR, RFQ, quotation comparison, cycle count, physical inventory, dispatch UI

## Epic 4 — QC / QA
- ✅ Spec-driven sample + result entry, OOS candidate detection, review, approval (e-sign)
- ✅ QA material disposition (release/reject) with e-sign
- ✅ OOS investigation lifecycle, QA approval
- ⬜ OOT statistics, stability studies, LIMS integration

## Epic 5 — Production
- ✅ Production plans, availability check, batch creation with numbering rules
- ✅ Material reservation, start, eBMR step execution, corrections, consumption, yield
- ✅ QA batch release transaction, FG lot creation
- ⬜ Capacity scheduling board, line clearance, label reconciliation

## Epic 6 — Quality events
- ✅ Deviations + RCA (5 Whys / fishbone) + aging
- ✅ CAPA + actions + effectiveness + closure (e-sign)
- 🟡 Recalls: traceability (forward/backward genealogy) and mock-recall reconciliation ✅; customer distribution register and recall workflow ⬜
- ⬜ Change control, complaints, audits, documents, training

## Epic 7 — Insight
- ✅ Management dashboard (KPIs, charts, filters, drill-down)
- ✅ Command Center exceptions
- ✅ Global search
- ✅ Product Quality Review data pack (PIC/S Ch. 1)
- 🟡 GS1 / serialization: GTIN master data, check-digit validation, (01)(17)(10) element string, Command Center readiness ✅; serial numbers, aggregation, regulator reporting ⬜
- ✅ Copilot (management), deviation & CAPA assistants (suggest-only)
- ⬜ Document Copilot (RAG with pgvector), expiry intelligence UI, quality trend detection page

## Epic 8 — Quality engineering
- ✅ Jest unit tests, Supertest e2e on real Postgres (tenant isolation, RBAC, scenarios A & B)
- ✅ Playwright e2e for both demo scenarios plus traceability/PQR
- ✅ Role-based PDF user manuals generated from genuine screenshots (`npm run manuals`)
- ⬜ Load tests, IQ/OQ validation package templates
