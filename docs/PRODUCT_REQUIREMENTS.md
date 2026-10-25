# Pharmodry — Product Requirements (refined)

> Pharmaceutical Operations, Quality & Compliance Intelligence Platform.
> Target: pharmaceutical **manufacturers** (not retail pharmacy). Initial market Pakistan / South Asia (DRAP), architected for international use.

## 1. Positioning

Pharmodry is an **operational and intelligence layer** that sits beside the customer's ERP (SAP, Oracle, Business Central), LIMS and paper systems. It does not replace financial ERP. Its differentiator is **exception-driven operations**: rather than making managers hunt through reports, the platform states *what* needs attention, *why*, *which process* it affects, *who* owns it, *how long* it has been pending and *what history* may help.

Core experience = **Command Center + regulated Quality workflows + AI Copilot**.

## 2. Compliance stance

The software provides **technical controls that support validated processes** (GMP, GxP, ALCOA+, 21 CFR Part 11 / EU Annex 11 concepts, DRAP GMP, ICH Q7/Q9/Q10). Using it does **not** by itself make a company compliant; computerized-system validation (CSV/CSA) remains the customer's responsibility. See `VALIDATION_NOTES.md`.

Every compliance-critical change records: who, what, previous value, new value, when (server UTC), reason where required, approval status and e-signature where required. Regulated records are **never silently overwritten** and never physically deleted (void/cancel instead).

## 3. MVP scope (release 1)

| # | Capability | Notes |
|---|---|---|
| 1 | Authentication | JWT access (15 min) + rotating refresh tokens, lockout, rate limiting, session tracking |
| 2 | Tenant / company setup | Tenant settings hold configurable thresholds and policies |
| 3 | Sites / plants | Company → Sites → Warehouses → Bins; Departments |
| 4 | Users | Admin-managed; no self sign-up |
| 5 | Roles & permissions | Permission-based RBAC, roles configurable, role assignment optionally scoped to a site |
| 6–8 | Product, Material, Supplier master | Versioned snapshots for regulated master data |
| 9 | Warehouse setup | Warehouses + bin locations |
| 10 | Lot-level inventory | Every quantity belongs to a lot at a location with a status |
| 11 | GRN | Optional PO reference; creates lots in **QUARANTINE** |
| 12 | Quarantine / release | QC sample auto-requested; QA disposition with e-signature |
| 13 | Production planning | Plan lines (product, qty, batches) + material availability check |
| 14 | Batch management | Lifecycle PLANNED → … → RELEASED/REJECTED → CLOSED; configurable numbering |
| 15 | Basic eBMR | Product routing template → batch steps; parameters, IPC readings, operator + supervisor sign-off, corrections with reason |
| 16 | QC sampling / results | Spec-driven results, automatic OOS-candidate flagging, review & approval |
| 17 | QA batch release | Single DB transaction, e-signature, blocks on open OOS / deviations / pending QC |
| 18 | Deviations | Workflow with aging, RCA (5-Whys, fishbone) |
| 19 | CAPA | Actions, effectiveness check, QA closure with e-signature |
| 20 | Audit trail | Central, append-only, hash-chained, DB-level immutability trigger |
| 21 | Electronic signatures | Re-authentication with password, meaning, reason, linked to audit event |
| 22 | Notifications | In-app; email-ready channel abstraction; scheduled scans |
| 23 | Management dashboard | KPI cards + charts + filters + drill-down |
| 24 | Command Center | Exceptions with owner, age, impact, link |
| 25 | Management Copilot | Mistral via backend only, intent → controlled retrieval → explain; citations; feedback |

Also delivered because the demo scenarios require them: **Purchase Orders (basic)**, **OOS investigations**, **Equipment with calibration policy**, **QC specifications & test methods**, deterministic **inventory stockout-risk** analytics, **global search**, **AI Deviation & CAPA assistants** (suggestions only).

## 4. Post-MVP (architected, not yet built)

Purchase requisitions/RFQ/quotation comparison, OOT trending, change control, document management + Document Copilot (RAG), training management, maintenance, audit management, complaints, real recall workflow and customer distribution register (traceability and mock-recall reconciliation were delivered during the audit, see AUDIT reports), regulatory affairs, supplier scorecards UI, ERP adapters (SAP / Oracle / Business Central), Excel import wizard, XLSX/PDF reports, Entra ID SSO, email delivery. See `IMPLEMENTATION_BACKLOG.md`.

## 5. Critical pharma rules (enforced server-side)

1. Inventory is lot/batch traceable — no aggregate-only stock.
2. Received material starts in `QUARANTINE` (tenant setting can only be changed by a privileged admin and is audited; default and demo = quarantine).
3. Production cannot reserve, issue or consume a lot that is not `RELEASED`, is expired, or is past retest date.
4. Finished goods are created `QUARANTINE` and become `RELEASED` only via QA batch release.
5. An open OOS investigation (or one concluded "confirmed OOS") blocks release.
6. Critical approvals require a specific permission **and** an e-signature with password re-entry.
7. Regulated records retain history (corrections table / versions / audit before–after values).
8. Audit trail is append-only — no API to modify it, DB trigger rejects UPDATE/DELETE.
9. Historical master-data versions are never overwritten.
10. AI cannot make GMP decisions — it has **no write access** to regulated tables; every suggestion is labelled and requires a human to copy/accept it.
11. AI cannot alter regulated records.
12. Workflows are explicit business endpoints (`/start`, `/complete`, `/qa-release`) — there is no generic "set status" endpoint.

## 6. Personas & key journeys

* **Warehouse Officer** — receives material (GRN), puts away, issues to production.
* **QC Analyst / QC Manager** — collects samples, enters results, reviews/approves.
* **QA Officer / QA Manager** — dispositions material lots, releases batches, runs deviations, OOS, CAPA.
* **Production Planner / Supervisor / Operator** — plans, creates batches, executes eBMR steps.
* **Plant Manager / Management Viewer** — dashboard, Command Center, Copilot.
* **Auditor** — read-only access including audit trail.

### Demo scenario A — happy path
Paracetamol API received → GRN → QUARANTINE → QC sample auto-generated → results entered & approved → QA releases lot (e-sign) → batch planned → materials reserved (FEFO) → production started → steps executed, consumption recorded → yield calculated → FP QC sample → results approved → QA releases batch (e-sign) → FG lot RELEASED → dashboard updates. Every step in audit trail.

### Demo scenario B — failure
Second batch → dissolution spec ≥ 80 %, result 74 % → OOS candidate flagged, OOS investigation opened automatically in `REPORTED` → QA release blocked → investigation phases → deviation linked → root cause documented → CAPA raised → QA review.

## 7. Non-functional requirements

* Multi-tenant from day one; every business row carries `tenantId`; enforced by an ORM extension in addition to explicit service filters.
* p95 API < 300 ms for list endpoints at 100k lots/tenant (indexes on tenant + status + dates).
* All timestamps stored UTC, displayed in tenant time zone (default `Asia/Karachi`).
* Desktop-first responsive UI; light & dark themes.
* Secrets only via environment variables; never shipped to the browser.

## 8. Assumptions & resolved contradictions

| # | Topic | Decision |
|---|---|---|
| A1 | "Do not build POS" vs dispatch | Dispatch is only modelled as inventory transaction type (post-MVP UI). |
| A2 | Deviation aging "16–30 attention, 30 overdue" overlaps at day 30 | Interpreted as 0–15 normal, 16–30 attention, **> 30** overdue; configurable in tenant settings. |
| A3 | AI deciding OOS | System flags an *OOS candidate* and opens an investigation record (GMP practice: report immediately). The **conclusion** (confirmed vs invalidated) is always a human QA decision with e-signature. |
| A4 | "Received material starts QUARANTINE unless configured otherwise" | Setting exists but default is quarantine; changing it is audited. Even when bypassed, an incoming lot never becomes RELEASED without a QA disposition record — bypass only allows skipping *sampling*, so in practice we keep it on. |
| A5 | Production Order entity | MVP links batches to plan lines directly; `ProductionOrder` is a backlog item (ERP usually owns it). |
| A6 | E-signature re-authentication "for high-risk signatures" | All MVP signatures are high-risk, so every signature re-checks the password. |
| A7 | Email login | Email is globally unique across tenants to simplify login; tenant is derived from the user. |
| A8 | Redis / BullMQ | Used when `REDIS_URL` is set; an in-process scheduler fallback keeps local dev working without Redis. |
| A9 | Mistral key absent | Copilot still answers with deterministic computed facts and citations, clearly labelled "AI provider not configured". |
| A10 | Yield tolerance breach | Batch cannot reach `AWAITING_QA` without a linked deviation **or** a documented justification (audited). |
| A11 | Expired calibration | Tenant policy `BLOCK` (default) or `WARN`; warn path requires a reason and is audited. |
| A12 | Copilot numbers | All figures computed in SQL/application code; the LLM only explains provided facts. |
