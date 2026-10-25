# Pharmodry — Management Viewer User Manual

- Product: Pharmodry 0.1.0 (MVP release)
- Intended audience: Executives using dashboards and the Copilot.
- Document version: 1.0
- Generated: 2026-10-25 (screenshots captured 2026-10-25)
- Role code: MANAGEMENT_VIEWER

> Screenshots show fictional demonstration data. Pharmodry is not a validated system; use within your approved SOPs.

## Contents

1. Purpose and scope
2. Role responsibilities
3. Signing in and signing out
4. Home page and dashboard overview
5. Navigation and module overview
6. Features and step-by-step instructions
7. Field-by-field explanations, required inputs and validation rules
8. Buttons and their functions
9. Workflow, approvals and electronic signatures
10. Status meanings
11. Search, filters, sorting and pagination
12. Reports and exports
13. Notifications and alerts
14. Error messages and troubleshooting
15. Common mistakes and how to prevent them
16. Security and access limitations
17. Practical end-to-end example
18. Frequently asked questions
19. Glossary
20. Escalation


## 1. Purpose and scope

Views the Command Center, dashboard and key records (batches, inventory, deviations, CAPAs, OOS, QC, suppliers, plans) and uses the Copilot. Read-only.

This manual covers every Pharmodry screen available to the Management Viewer role in release 0.1.0. Your exact access is set by your company’s administrator; if your account has additional roles or a site restriction, you may see more or fewer options than described. Configuration-dependent behaviour (for example tolerances, aging thresholds, calibration policy, AI availability) is marked as such.

> **Not available in this release:** Pharmacovigilance, sales/distribution and accounting modules; customer-level distribution in recalls; e-mail notifications; serial-number management; MFA/single sign-on. These are not described as working anywhere in this manual.


## 2. Role responsibilities

- Monitor KPIs and exceptions.
- Follow up owners through normal management channels.


### Dependencies on other departments

- Plant Manager and QA Manager — explanations and actions.


## 3. Signing in and signing out

1. Open the Pharmodry address provided by your administrator in a current browser (Microsoft Edge, Chrome or Firefox).
2. Enter your company e-mail address and password and select Sign in.
3. After five consecutive wrong passwords the account is locked for 15 minutes; an administrator can unlock it.
4. To sign out, open the user menu at the top right and choose Sign out. Always sign out on shared computers.
5. Change your password under Profile & security → Change password (at least 10 characters with upper-case, lower-case and a digit). Your password is also your electronic-signature credential — never share it.
6. Profile → Active sessions lists devices signed in to your account; revoke any session you do not recognise.

![Figure 1](../SCREENSHOTS/common/login_annotated.png)

*Figure 1 — Sign-in page. Sign-in page. Enter your company e-mail and password, then select Sign in.*

1. Company e-mail address
2. Password (also your e-signature credential)
3. Sign in

![Figure 2](../SCREENSHOTS/management_viewer/profile.png)

*Figure 2 — Profile & security. Profile: password change and active sessions.*


## 4. Home page and dashboard overview

After sign-in you land on My work. It greets you by name and lists the work queues that match your permissions — for example batches awaiting QA release, material lots awaiting disposition, open QC samples, deviations or CAPAs you own, batches on the shop floor, planned batches to prepare and purchase orders awaiting receipt. Each queue links straight to the records. Queues you have no permission for are not shown.

![Figure 3](../SCREENSHOTS/management_viewer/my_work.png)

*Figure 3 — My work (home). Home page with the work queues available to this role.*


### Pharma Command Center

The Command Center answers “what needs attention right now, why, which process it affects, who owns it and how long it has been pending”. Items are grouped into Batches at risk, Quality issues, Materials at risk, Inventory risks, Compliance deadlines and Supplier risks, and each carries a severity (Critical, Warning, Info), owner, age and a link to the record. It also lists serialization-readiness gaps such as active products without a GTIN.

![Figure 4](../SCREENSHOTS/management_viewer/command_center.png)

*Figure 4 — Command Center. Exception-driven Command Center: what needs attention, why, owner and age.*


### Management dashboard

KPI cards (Active batches, Awaiting QA release, Open deviations, Overdue CAPAs, Open OOS, Materials at high risk, Near-expiry inventory, Plan achievement, Avg batch release time, Supplier quality score) and charts: Production plan vs actual, Batch yield trend (shaded band = configured tolerance), Deviation trend, CAPA aging, OOS trend, Inventory value by status, Near-expiry inventory, Supplier QC rejection rate and Batch release cycle time. All figures are computed from live regulated records.

![Figure 5](../SCREENSHOTS/management_viewer/dashboard.png)

*Figure 5 — Management dashboard. KPI cards and charts computed from live records; click a KPI to drill down.*


## 5. Navigation and module overview

- The left sidebar lists only the modules your role can open, grouped into Overview, Supply & inventory, Production, Quality, Master data and Governance.
- The top bar has global search (“Search batches, lots, deviations, CAPAs…”, shortcut Ctrl K), a “Demo data” badge in demonstration environments, the light/dark theme toggle, the notification bell and your user menu (name and job title).
- Record numbers are links; detail pages show a status badge, key facts, actions you may perform and tabs with history.

The sidebar below was recorded from the application while signed in as the demo Management Viewer (management@novacure.demo).

| Sidebar group | Menu entry | Address |
|---|---|---|
| Overview | My work | / |
| Overview | Command Center | /command-center |
| Overview | Dashboard | /dashboard |
| Overview | Copilot | /copilot |
| Supply & inventory | Goods receipts | /inventory/receipts |
| Supply & inventory | Inventory | /inventory |
| Supply & inventory | Stock movements | /inventory/movements |
| Production | Production plans | /production/plans |
| Production | Batches & eBMR | /production/batches |
| Production | Traceability & recall | /traceability |
| Quality | QC samples | /quality/samples |
| Quality | OOS investigations | /quality/oos |
| Quality | Deviations | /quality/deviations |
| Quality | CAPA | /quality/capa |
| Quality | Product quality review | /quality/pqr |
| Master data | Products | /master-data/products |
| Master data | Materials | /master-data/materials |
| Master data | Suppliers | /master-data/suppliers |
| Master data | Equipment | /master-data/equipment |
| Master data | Specifications | /master-data/specifications |


## 6. Features and step-by-step instructions

Each section explains a module you can open, the procedures you are allowed to perform (numbered steps) and screenshots of the real screens. Procedures that need permissions your role does not hold are listed under “Not available to your role”.


### Copilot (AI assistant)

Ask questions in plain language about batches, quality events, inventory and suppliers — for example “Which CAPAs are overdue?”, “Which batches are awaiting QA release?”, “Which materials are at risk of stock-out?”. Pharmodry computes the figures from live records you are allowed to see; the AI model only explains them and lists citations (links to the records). The Copilot cannot approve, release or change any record.

> **Note:** If the banner “AI provider not configured” appears, the server has no Mistral API key: you still receive the computed facts and links, but no prose explanation. This is configuration-dependent.

> **Note:** If you ask about data you have no permission for, the Copilot tells you which permission is required instead of answering.

![Figure 6](../SCREENSHOTS/management_viewer/copilot.png)

*Figure 6 — Copilot. Copilot question box. Answers are computed by Pharmodry; the AI only explains them.*


#### Ask the Copilot

1. Open Copilot from the sidebar.
2. Type your question in “Ask a question about your operation…” and select Send.
3. Read the answer and open the cited records to verify.
4. Rate the answer with Thumbs up / Thumbs down to help administrators monitor quality.


### Goods receipts (GRN)

Every receipt line creates a separate lot with its own internal lot number in QUARANTINE and automatically requests a QC sample. Material only becomes usable after QC approval and QA release. Receipts are refused for expired material, for suppliers that are not qualified, for materials not approved for the supplier, and when the expiry date is before the manufacturing date.

![Figure 7](../SCREENSHOTS/management_viewer/grn_list.png)

*Figure 7 — Goods receipts. Goods receipts (GRN). Every line creates a lot in QUARANTINE.*

![Figure 8](../SCREENSHOTS/management_viewer/grn_detail.png)

*Figure 8 — Goods receipt detail. Received lots and their status after a goods receipt.*

> **Not available to your role:** Receive material — requires inventory.receive.


### Inventory, lots and stock movements

Inventory is held per lot and location with a status. Only RELEASED, unexpired lots that are not past retest can be reserved or consumed; quarantined, under-test, rejected, blocked or expired lots never can. Tabs: Lots, Stock by material, Stock-out risk and Expiry intelligence. Every quantity change is written to an append-only ledger (Stock movements).

![Figure 9](../SCREENSHOTS/management_viewer/inventory_list.png)

*Figure 9 — Inventory. Lot-level inventory with status, location and expiry filters.*

![Figure 10](../SCREENSHOTS/management_viewer/inventory_risk.png)

*Figure 10 — Stock-out risk. Stock-out risk by material (released stock vs planned demand and lead time).*

![Figure 11](../SCREENSHOTS/management_viewer/inventory_expiry.png)

*Figure 11 — Expiry intelligence. Expiry intelligence buckets with recommended actions.*

![Figure 12](../SCREENSHOTS/management_viewer/lot_quarantine.png)

*Figure 12 — Lot in quarantine. A quarantined lot: release is blocked until QC approval; blockers are listed.*

![Figure 13](../SCREENSHOTS/management_viewer/lot_released.png)

*Figure 13 — Released lot. A released material lot with available quantity, location and expiry.*

![Figure 14](../SCREENSHOTS/management_viewer/movements.png)

*Figure 14 — Stock movements. Append-only inventory ledger of every movement.*


#### Find a lot

1. Open Inventory.
2. Use the quick views (All on hand, Available (released), Awaiting disposition, Expiring ≤ 30 d / ≤ 60 d / ≤ 90 d, Expired) and the Status, Type and Warehouse filters.
3. Type part of a lot or item name in the table search.
4. Select a lot number to open the lot page (Overview, Movements, QC, Used in batches, Audit trail).

> **Not available to your role:** Release or reject a material lot (QA disposition) — requires inventory.release; Transfer stock — requires inventory.transfer; Post a stock adjustment — requires inventory.adjust; Block or unblock a released lot — requires inventory.release; Export inventory and expiry lists — requires report.export.


### Production plans

A production plan holds, per product, the planned quantity and number of batches for a period. Achievement = released batch output ÷ planned quantity. Plan detail shows feasibility (Feasible / Shortage) per line based on released stock.

![Figure 15](../SCREENSHOTS/management_viewer/plan_list.png)

*Figure 15 — Production plans. Production plans with achievement against released output.*

![Figure 16](../SCREENSHOTS/management_viewer/plan_detail.png)

*Figure 16 — Production plan detail. Plan lines with material feasibility and batch creation.*

> **Not available to your role:** Create a production plan — requires production.plan.manage; Approve a plan — requires production.plan.approve; Create a batch from a plan line — requires batch.create.


### Batches and electronic batch records (eBMR)

Batch lifecycle: Planned → Material reserved → Ready → In progress → Awaiting QC → Awaiting QA → Released / Rejected → Closed (or Cancelled before start). The batch page has tabs Overview, Manufacturing (eBMR), Materials, QC, Deviations, Approvals and Audit trail, and shows GS1 data (GTIN, expiry, batch) for the 2D DataMatrix when the product has a GTIN.

![Figure 17](../SCREENSHOTS/management_viewer/batch_list.png)

*Figure 17 — Batches & eBMR. Batch list with lifecycle status, yield and QA decision.*

![Figure 18](../SCREENSHOTS/management_viewer/batch_released.png)

*Figure 18 — Released batch — overview. Overview of a released batch: yield, finished goods, GS1 data and QA decision.*

![Figure 19](../SCREENSHOTS/management_viewer/batch_ebmr_progress.png)

*Figure 19 — Batch in progress — eBMR. Electronic batch record of a batch in progress: steps, parameters, signatures.*

![Figure 20](../SCREENSHOTS/management_viewer/batch_blocked.png)

*Figure 20 — Batch blocked by OOS. A batch whose release is blocked: failed QC and an open OOS investigation.*

![Figure 21](../SCREENSHOTS/management_viewer/batch_shortage.png)

*Figure 21 — Batch with material shortage. A planned batch that cannot reserve materials because released stock is insufficient.*

![Figure 22](../SCREENSHOTS/management_viewer/batch_record.png)

*Figure 22 — Printable batch record. Print-ready batch manufacturing record (use the browser’s Save as PDF).*


#### Print the batch manufacturing record

1. Open the batch and select Batch record (opens in a new tab).
2. Use Print / the browser’s Save as PDF.

> **Not available to your role:** Create a batch — requires batch.create; Reserve materials (FEFO) — requires batch.reserve; Issue materials to production — requires inventory.issue; Start the batch — requires batch.start; Execute an eBMR step — requires batch.execute; Verify eBMR steps — requires batch.verify; Record a correction — requires batch.execute or batch.verify; Complete manufacturing — requires batch.complete; QA release or rejection of a batch — requires batch.approve; Raise a deviation from a batch — requires deviation.create.


### Traceability and mock recall

Backward genealogy (what went into a batch: material lots, suppliers, supplier batches, GRNs and QC release evidence), forward trace (where a material lot went: batches and finished goods) and the mock-recall reconciliation of a batch (produced vs on hand + dispatched − returned ± adjustments/samples, with any unaccounted quantity highlighted). Customer-level distribution is held in the ERP/distribution system and is not captured in this release.

![Figure 23](../SCREENSHOTS/management_viewer/traceability.png)

*Figure 23 — Traceability & mock recall. Mock recall reconciliation of a released batch.*

![Figure 24](../SCREENSHOTS/management_viewer/traceability_backward.png)

*Figure 24 — Backward genealogy. Input material lots with supplier, GRN and QC release evidence.*


#### Run a mock recall for a batch

1. Open Traceability & recall (or Trace on a batch page).
2. Type a batch number, internal lot or supplier batch and select Trace; choose the batch in the results.
3. Read the reconciliation cards. “Quantities reconcile” means every unit is accounted for; “Reconciliation gap” shows the unaccounted quantity to investigate.
4. Review Current locations and Finished-goods movements.
5. Users with report.export can select Export recall reconciliation (CSV, audited).


#### Trace a supplier lot forward

1. Search the internal lot or supplier batch, or select Trace on a material lot page.
2. The forward trace lists every batch that reserved or consumed the lot and the finished-goods lots produced, with on-hand and dispatched quantities.


### QC samples and results

Sample request → collection → testing → submission → review → approval (e-signature). Samples are requested automatically by goods receipts (raw/packaging material) and batch completion (finished product). Each result is evaluated against a snapshot of the specification; results outside specification are flagged as OOS candidates and an OOS investigation opens automatically.

![Figure 25](../SCREENSHOTS/management_viewer/sample_list.png)

*Figure 25 — QC samples. QC sample list by status and stage.*

![Figure 26](../SCREENSHOTS/management_viewer/sample_detail.png)

*Figure 26 — QC sample detail. A QC sample awaiting collection, with specification tests.*

> **Not available to your role:** Record sample collection — requires qc.sample.collect; Enter results — requires qc.result.enter; Review results — requires qc.result.review; Approve a sample — requires qc.result.approve; Replace a result — requires qc.result.enter.


### OOS investigations

Out-of-specification results are reported automatically when a QC result falls outside its specification. The investigation follows fixed phases: Reported → Preliminary investigation → Laboratory investigation (Phase I) → Manufacturing investigation (Phase II) → Root cause → Impact assessment → CAPA → QA approval → Closed. Phases cannot be skipped. The conclusion — CONFIRMED OOS or INVALIDATED (lab error) — is a QA decision with electronic signature; invalidation requires an assignable laboratory error.

![Figure 27](../SCREENSHOTS/management_viewer/oos_list.png)

*Figure 27 — OOS investigations. Out-of-specification investigations with phase and owner.*

![Figure 28](../SCREENSHOTS/management_viewer/oos_detail.png)

*Figure 28 — OOS investigation detail. OOS investigation with phase stepper, linked records and QA conclusion area.*

> **Not available to your role:** Record an investigation phase — requires oos.investigate; Conclude the investigation (QA) — requires oos.approve.


### Deviations

Draft → Submitted → QA review → Investigation → Root cause → CAPA → Effectiveness check → QA closure. Aging: 0–15 days normal, 16–30 attention, more than 30 overdue (configurable). Root-cause analysis uses structured 5-Whys and a fishbone (6M) category; each save is versioned and QA approves the final root cause.

![Figure 29](../SCREENSHOTS/management_viewer/deviation_list.png)

*Figure 29 — Deviations. Deviation register with classification, aging and owner.*

![Figure 30](../SCREENSHOTS/management_viewer/deviation_detail.png)

*Figure 30 — Deviation detail. Deviation record with workflow actions, RCA, CAPAs and evidence.*

> **Not available to your role:** Raise a deviation — requires deviation.create; QA review and classification — requires deviation.approve; Investigate and record the root cause — requires deviation.investigate; CAPA decision and closure — requires deviation.approve; Use the AI investigation assistant — requires ai.assist.use.


### CAPA

Corrective and preventive actions from deviations, OOS, OOT, audits, complaints, supplier issues and recalls. Each CAPA has actions with owners and due dates, effectiveness criteria and an effectiveness check. Closure requires a successful effectiveness check and a QA electronic signature; a failed check returns the CAPA to In Progress and is counted in the effectiveness-failure KPI.

![Figure 31](../SCREENSHOTS/management_viewer/capa_list.png)

*Figure 31 — CAPA. CAPA register with priority, owner and due date.*

![Figure 32](../SCREENSHOTS/management_viewer/capa_detail.png)

*Figure 32 — CAPA detail. CAPA with actions, effectiveness check and closure.*

> **Not available to your role:** Create a CAPA — requires capa.create; Complete actions — requires capa.manage; Effectiveness check — requires capa.verify; Close a CAPA — requires capa.close.


### Product Quality Review (PQR) data pack

Figures computed for the PIC/S GMP Chapter 1 product quality review: batches manufactured with yield statistics, finished-product QC results (approved samples), deviations, OOS investigations, CAPAs and starting materials with suppliers. QA authors the evaluation and conclusions. Sections not captured in this release (for example stability, complaints, returns, change control) are listed so they can be added from source systems.

![Figure 33](../SCREENSHOTS/management_viewer/pqr.png)

*Figure 33 — Product Quality Review. Product Quality Review data pack for a product and period.*


#### Prepare a PQR data pack

1. Open Product quality review.
2. Choose Product, From and To dates.
3. Review sections 1–6 and the “Sections not captured in this release” notice.
4. Select Print / PDF to save the pack.


### Master data: products, materials, suppliers, equipment and specifications

Regulated master data is versioned: every change requires a reason and creates a new immutable version (Version history). Products carry registration, shelf life, storage, GTIN (GS1, check digit verified), BOM and manufacturing template; materials carry type, retest period, safety stock and lead time; suppliers carry qualification status, approved materials and certifications; equipment carries calibration frequency and history; specifications hold versioned acceptance criteria.

![Figure 34](../SCREENSHOTS/management_viewer/products.png)

*Figure 34 — Products. Product master list with GTIN and registration.*

![Figure 35](../SCREENSHOTS/management_viewer/product_detail.png)

*Figure 35 — Product detail. Product detail: BOM, manufacturing template, specifications and versions.*

![Figure 36](../SCREENSHOTS/management_viewer/materials.png)

*Figure 36 — Materials. Material master with released and quarantined stock.*

![Figure 37](../SCREENSHOTS/management_viewer/material_detail.png)

*Figure 37 — Material detail. Material detail: lots in FEFO order, approved suppliers, specifications.*

![Figure 38](../SCREENSHOTS/management_viewer/suppliers.png)

*Figure 38 — Suppliers. Supplier list with qualification status and scorecards.*

![Figure 39](../SCREENSHOTS/management_viewer/supplier_detail.png)

*Figure 39 — Supplier detail. Supplier qualification, approved materials, certifications and receipts.*

![Figure 40](../SCREENSHOTS/management_viewer/equipment.png)

*Figure 40 — Equipment & calibration. Equipment list with calibration status.*

![Figure 41](../SCREENSHOTS/management_viewer/equipment_detail.png)

*Figure 41 — Equipment detail. Equipment detail with calibration history.*

![Figure 42](../SCREENSHOTS/management_viewer/specifications.png)

*Figure 42 — QC specifications. Versioned QC specifications.*

![Figure 43](../SCREENSHOTS/management_viewer/specification_detail.png)

*Figure 43 — Specification detail. Specification tests and acceptance criteria.*

> **Not available to your role:** Create or edit a product — requires product.manage; Create or edit a material — requires material.manage; Create a supplier — requires supplier.manage; Change supplier qualification / approve a material — requires supplier.approve or supplier.manage; Record equipment calibration — requires equipment.manage.


## 7. Field-by-field explanations, required inputs and validation rules

General rules: required fields are marked; dates use the date picker; numbers must be positive unless stated; reasons must be at least 5 characters; unknown or malformed inputs are rejected by the server. Forms that you cannot submit are still shown for reference where you can view the module.

Your role does not create or edit records in modules with data-entry forms (read-only or approval-only access); the screens you use are explained in chapter 6.


## 8. Buttons and their functions

| Module | Button | What it does | Available to you |
|---|---|---|---|
| Goods receipts (GRN) | New | Opens the receipt form. | No (needs inventory.receive) |
| Goods receipts (GRN) | Load lines | Copies lines from the selected PO. | No (needs inventory.receive) |
| Goods receipts (GRN) | Add line / Remove line | Manages receipt lines. | No (needs inventory.receive) |
| Goods receipts (GRN) | Create GRN | Posts the receipt; lots go to QUARANTINE. | No (needs inventory.receive) |
| Inventory, lots and stock movements | QA release / Reject | QA disposition with electronic signature. | No (needs inventory.release) |
| Inventory, lots and stock movements | Transfer | Moves stock between locations. | No (needs inventory.transfer) |
| Inventory, lots and stock movements | Adjust | Posts a signed quantity change with reason. | No (needs inventory.adjust) |
| Inventory, lots and stock movements | Block / Unblock | Temporarily prevents use of a released lot. | No (needs inventory.release) |
| Inventory, lots and stock movements | Trace | Opens forward traceability for a material lot. | Yes |
| Batches and electronic batch records (eBMR) | Reserve materials | FEFO reservation of released lots. | No (needs batch.reserve) |
| Batches and electronic batch records (eBMR) | Release reservation | Returns reservations (reason required). | No (needs batch.reserve) |
| Batches and electronic batch records (eBMR) | Issue materials | Dispenses reserved lots to production. | No (needs inventory.issue) |
| Batches and electronic batch records (eBMR) | Start batch | Moves READY → IN PROGRESS. | No (needs batch.start) |
| Batches and electronic batch records (eBMR) | Start / Record & sign | Executes and signs eBMR steps. | No (needs batch.execute) |
| Batches and electronic batch records (eBMR) | Verify | Second-person verification with signature. | No (needs batch.verify) |
| Batches and electronic batch records (eBMR) | Correct | Corrects a recorded value with reason. | No (needs batch.execute) |
| Batches and electronic batch records (eBMR) | Complete manufacturing | Calculates yield, books FG into quarantine. | No (needs batch.complete) |
| Batches and electronic batch records (eBMR) | QA release / Reject | Final disposition with electronic signature. | No (needs batch.approve) |
| Batches and electronic batch records (eBMR) | Close batch | Closes a released or rejected batch. | No (needs batch.approve) |
| Batches and electronic batch records (eBMR) | Cancel | Cancels a batch before it starts (reason required). | No (needs batch.create) |
| Batches and electronic batch records (eBMR) | Trace | Opens traceability & mock recall for the batch (needs inventory.view too). | Yes |
| Batches and electronic batch records (eBMR) | Batch record | Printable executed batch record. | Yes |
| Traceability and mock recall | Trace | Searches batches and material lots (needs batch.view and inventory.view). | Yes |
| Traceability and mock recall | Export recall reconciliation | CSV export, recorded in the audit trail. | No (needs report.export) |
| QC samples and results | Record collection | Records collection and sampled quantity. | No (needs qc.sample.collect) |
| QC samples and results | Save results | Stores and evaluates results. | No (needs qc.result.enter) |
| QC samples and results | Submit for review | Sends results for review. | No (needs qc.result.enter) |
| QC samples and results | Accept review / Return to analyst | Second-person review or return to analyst. | No (needs qc.result.review) |
| QC samples and results | Approve (e-sign) | Approval with electronic signature. | No (needs qc.result.approve) |

Buttons you cannot use are hidden or disabled in the application; the server refuses the action even if attempted another way.


## 9. Workflow, approvals and electronic signatures

The table shows the main GMP workflow and where your role takes part. Segregation of duties is enforced by the server: the person who performs a step cannot review, verify or approve it.

| Workflow step | Permission | Your role |
|---|---|---|
| Raise purchase order | procurement.po.create | — |
| Approve purchase order (different person) | procurement.po.approve | — |
| Receive goods (GRN) → lots in QUARANTINE, QC sample requested | inventory.receive | — |
| Collect sample and enter results | qc.result.enter | — |
| Review results (different person) | qc.result.review | — |
| Approve QC sample (e-signature) | qc.result.approve | — |
| QA disposition of material lot (e-signature) | inventory.release | — |
| Create / approve production plan | production.plan.manage | — |
| Create batch | batch.create | — |
| Reserve materials (FEFO, released lots only) | batch.reserve | — |
| Issue materials to production | inventory.issue | — |
| Start batch | batch.start | — |
| Execute and sign eBMR steps | batch.execute | — |
| Verify eBMR steps (different person, e-signature) | batch.verify | — |
| Complete manufacturing (yield, FG to QUARANTINE) | batch.complete | — |
| Finished-product QC (enter / review / approve) | qc.result.enter | — |
| QA batch release or rejection (e-signature) | batch.approve | — |
| Raise deviation | deviation.create | — |
| Investigate deviation / OOS | deviation.investigate | — |
| Classify, approve and close deviations | deviation.approve | — |
| Conclude OOS (e-signature) | oos.approve | — |
| Create and manage CAPA | capa.create | — |
| Close CAPA (e-signature) | capa.close | — |


### Electronic signatures

- Critical actions (approvals, releases, rejections, verifications, closures) open an Electronic signature dialog.
- Read the meaning of the signature shown in the dialog, enter a reason where requested and re-enter your password.
- “Your signature is legally binding within your company’s validated procedures.” A wrong password changes nothing and the failed attempt is recorded.
- The signature (your name, meaning, reason, time) is stored with the record and in the audit trail.


## 10. Status meanings

| Status | Meaning |
|---|---|
| RECEIVED | Fully received (PO) / receipt posted (GRN). |
| COMPLETED | eBMR step completed and signed by the operator (or CAPA action completed). |
| CANCELLED | Cancelled with a reason; kept on record. |
| QUARANTINE | Received or produced, not yet approved for use. |
| UNDER TEST | Sampled; QC testing in progress. |
| RELEASED | Approved by QA (lot) or released for sale (batch). |
| REJECTED | Rejected by QA; may not be used or sold. |
| BLOCKED | Temporarily blocked by QA. |
| EXPIRED | Past expiry date; cannot be used. |
| RETURNED | Returned stock. |
| RECALLED | Subject to a recall. |
| DRAFT | Draft, not yet submitted/approved. |
| APPROVED | Approved (sample, supplier, PO or plan). |
| CLOSED | Completed and closed. |
| PLANNED | Batch created; materials not yet reserved. |
| MATERIAL RESERVED | Released lots reserved (FEFO). |
| READY | Materials issued; batch can start. |
| IN PROGRESS | Manufacturing in progress (batch, step or CAPA). |
| AWAITING QC | Manufacturing complete; finished-product QC pending. |
| AWAITING QA | QC complete; QA decision pending. |
| PENDING | eBMR step not started. |
| VERIFIED | eBMR step verified by a second person. |
| REQUESTED | QC sample requested. |
| COLLECTED | Sample collected. |
| IN TESTING | Results being entered. |
| SUBMITTED | Submitted for review. |
| REVIEWED | Reviewed; awaiting approval. |
| PASS | QC conclusion: meets specification. |
| FAIL | QC conclusion: does not meet specification. |
| WITHIN SPEC | Result within specification. |
| OOS CANDIDATE | Result outside specification — OOS investigation opened. |
| REPORTED | OOS reported; investigation not started. |
| PRELIMINARY INVESTIGATION | OOS preliminary investigation. |
| LAB INVESTIGATION | OOS Phase I laboratory investigation. |
| MANUFACTURING INVESTIGATION | OOS Phase II manufacturing investigation. |
| ROOT CAUSE | Root cause being documented. |
| IMPACT ASSESSMENT | Impact on other batches/products assessed. |
| CAPA | CAPA decision stage. |
| QA APPROVAL | Awaiting QA conclusion. |
| CONFIRMED OOS | QA concluded the result is a true OOS. |
| INVALIDATED LAB ERROR | QA invalidated the result due to an assignable laboratory error. |
| QA REVIEW | Deviation under QA review. |
| INVESTIGATION | Deviation under investigation. |
| EFFECTIVENESS CHECK | Awaiting effectiveness check. |
| MINOR | Minor deviation. |
| MAJOR | Major deviation. |
| CRITICAL | Critical deviation / priority. |
| OPEN | Open CAPA or action. |
| LOW | Low priority. |
| MEDIUM | Medium priority. |
| HIGH | High priority. |
| ACTIVE | Active master data. |
| INACTIVE | Inactive; cannot be used for new transactions. |
| PENDING QUALIFICATION | Supplier not yet qualified. |
| CONDITIONALLY APPROVED | Supplier approved with conditions. |
| SUSPENDED | Supplier suspended. |
| BLACKLISTED | Supplier barred. |
| QUALIFIED | Equipment qualified. |
| NOT QUALIFIED | Equipment not qualified. |
| RETIRED | Equipment retired. |


## 11. Search, filters, sorting and pagination

- Search table: type to filter rows in the current list.
- Quick views and filters above the table (for example Open / Overdue / All, status, type, warehouse) narrow the list; Saved filters stores your combination.
- Choose columns shows or hides columns; select a column header to sort.
- Rows per page and Previous / Next page control pagination (up to 200 rows per page).
- Export CSV downloads the current list (requires the export permission; exports are audited).


## 12. Reports and exports

| Report | Where | Export allowed |
|---|---|---|
| Batch summary (CSV) | Reports → Batch summary | View only — export needs report.export |
| Batch manufacturing record (print / PDF) | Batch page → Batch record | Yes (print) |
| Inventory status (CSV) | Reports or Inventory → Export CSV | View only — export needs report.export |
| Near-expiry inventory (CSV) | Reports or Inventory → Expiry intelligence | View only — export needs report.export |
| Expired stock (CSV) | Reports | View only — export needs report.export |
| Deviation register (CSV) | Deviations → Export CSV | View only — export needs report.export |
| CAPA register (CSV) | CAPA → Export CSV | View only — export needs report.export |
| OOS register (CSV) | OOS investigations → Export CSV | View only — export needs report.export |
| QC summary (CSV) | QC samples → Export CSV | View only — export needs report.export |
| Supplier performance (CSV) | Suppliers → Export CSV | View only — export needs report.export |
| Mock-recall reconciliation (CSV) | Traceability & recall → Export recall reconciliation | View only — export needs report.export |
| Product Quality Review data pack (print / PDF) | Product quality review → Print / PDF | Yes (print) |

Every export is recorded in the audit trail. CSV files are UTF-8 and protected against spreadsheet formula injection.


## 13. Notifications and alerts

- The bell shows unread notifications; Notifications → Inbox lists them and Mark all read clears the counter.
- Alerts come from workflows (for example QC sample requested, OOS reported, batch awaiting QA, assignment) and scheduled compliance scans (expiry, low stock, overdue CAPAs/deviations, calibration due, QA backlog).
- My preferences lets you choose which notifications you receive. In-app delivery is on by default; e-mail delivery requires SMTP configuration by an administrator and is not active in this release.

![Figure 44](../SCREENSHOTS/management_viewer/notifications.png)

*Figure 44 — Notifications. Notification inbox and preferences.*


## 14. Error messages and troubleshooting

| Message or symptom | Cause | What to do |
|---|---|---|
| 403 / “Missing permission …” | Your role does not include the permission, or it is limited to another site. | Ask your Company Admin to review your role assignment. |
| “Action blocked by business rules” with a list of reasons | A GMP rule prevents the action (for example QC not approved). | Open each reason link and resolve it; the rule cannot be overridden. |
| “Account locked after repeated failed attempts” | Five wrong passwords. | Wait 15 minutes or ask an administrator to unlock. |
| Session expired / returned to sign-in | Inactive session or revoked session. | Sign in again. |
| Electronic signature failed | Wrong password. | Re-enter the password; nothing was saved. |
| “… was modified concurrently; reload and retry” | Another user changed the record. | Reload the page and repeat your action. |
| Unknown field / validation messages on forms | Missing or invalid input. | Correct the highlighted fields. |
| Receipt rejected by business rules | Expired material, unqualified supplier, unapproved material or invalid dates. | Correct the data, or quarantine the delivery physically and inform QA/procurement. |
| Supplier not qualified | The supplier is pending, suspended or blacklisted. | Do not receive; contact QA (supplier qualification). |
| This lot cannot be released yet | QC sample not approved, failed, or other blockers. | Complete QC; follow up the listed blocker links. |
| Insufficient released material to reserve this batch | Released, unexpired stock is lower than required (quarantined stock never counts). | Expedite QC/QA of quarantined lots or procure more. |
| Insufficient released material to reserve this batch | Shortage of released stock. | Escalate to planning/QA; do not use quarantined stock. |
| Calibration expired | Selected equipment is past its calibration due date. | Use other equipment or contact Engineering; under BLOCK policy the step cannot start. |
| Segregation of duties: the operator who performed a step cannot verify it | Same person. | Ask another supervisor. |
| QA release is blocked | Release blockers exist. | Resolve each listed reason first. |
| Batch … was modified concurrently; reload and retry | Someone else changed the batch. | Reload the page and repeat. |
| Enter at least one result | Save without values. | Enter results first. |
| Segregation of duties: an analyst cannot approve their own results | Same person. | Another authorised person approves. |
| OOS investigation open — approval and release are blocked | A result is an OOS candidate. | Complete the OOS investigation first. |
| Phase cannot be completed | Required findings missing. | Fill in the phase findings. |
| Segregation of duties: the investigation owner cannot give the QA conclusion | Same person. | Another QA approver concludes. |
| Action blocked by business rules | Required information missing for the next step. | Read the listed reasons and complete them. |
| Action blocked | For example closing without a successful effectiveness check. | Complete the effectiveness check first. |
| GTIN … is not a valid GS1 GTIN (length or check digit) | Wrong length or check digit. | Enter the 8, 12, 13 or 14-digit GTIN exactly as allocated by GS1. |


## 15. Common mistakes and how to prevent them

- Entering supplier batch, expiry or quantities that differ from the container label or CoA — always copy exactly.
- Trying to use quarantined or under-test material — only RELEASED lots can be reserved; wait for QA release.
- Signing for someone else or sharing passwords — each signature must be your own.
- Delaying deviation reporting — raise the deviation as soon as the event is known; QA classifies it.
- Replacing results to “fix” an OOS — OOS results cannot be replaced during an investigation; follow the OOS procedure.
- Closing CAPAs without objective evidence — the effectiveness check must be documented.


## 16. Security and access limitations

Permissions granted to your role (as enforced by the server):

| Permission | Meaning |
|---|---|
| ai.copilot.use | Use the management copilot |
| analytics.view | View dashboards and analytics |
| batch.view | View batches and eBMR |
| capa.view | View CAPAs |
| commandcenter.view | View Pharma Command Center |
| deviation.view | View deviations |
| inventory.view | View inventory lots and movements |
| masterdata.view | View master data |
| oos.view | View OOS investigations |
| production.plan.view | View production plans |
| qc.view | View QC samples and results |
| supplier.view | View suppliers |

Not granted (47 permissions): admin.tenant.manage, admin.site.manage, admin.user.manage, admin.role.manage, product.manage, material.manage, supplier.manage, supplier.approve, equipment.manage, spec.manage, procurement.po.view, procurement.po.create, procurement.po.approve, inventory.receive, inventory.transfer, inventory.adjust, inventory.issue, inventory.release, production.plan.manage, production.plan.approve, batch.create, batch.reserve, batch.start, batch.execute, batch.verify, batch.complete, batch.approve, qc.sample.create, qc.sample.collect, qc.result.enter, qc.result.review, qc.result.approve, oos.create, oos.investigate, oos.approve, deviation.create, deviation.investigate, deviation.approve, capa.create, capa.manage, capa.verify, capa.close, audit.view, audit.export, report.export, ai.assist.use, ai.admin.


### Procedures you cannot perform

- Goods receipts (GRN): Receive material — requires inventory.receive
- Inventory, lots and stock movements: Release or reject a material lot (QA disposition) — requires inventory.release
- Inventory, lots and stock movements: Transfer stock — requires inventory.transfer
- Inventory, lots and stock movements: Post a stock adjustment — requires inventory.adjust
- Inventory, lots and stock movements: Block or unblock a released lot — requires inventory.release
- Inventory, lots and stock movements: Export inventory and expiry lists — requires report.export
- Production plans: Create a production plan — requires production.plan.manage
- Production plans: Approve a plan — requires production.plan.approve
- Production plans: Create a batch from a plan line — requires batch.create
- Batches and electronic batch records (eBMR): Create a batch — requires batch.create
- Batches and electronic batch records (eBMR): Reserve materials (FEFO) — requires batch.reserve
- Batches and electronic batch records (eBMR): Issue materials to production — requires inventory.issue
- Batches and electronic batch records (eBMR): Start the batch — requires batch.start
- Batches and electronic batch records (eBMR): Execute an eBMR step — requires batch.execute
- Batches and electronic batch records (eBMR): Verify eBMR steps — requires batch.verify
- Batches and electronic batch records (eBMR): Record a correction — requires batch.execute or batch.verify
- Batches and electronic batch records (eBMR): Complete manufacturing — requires batch.complete
- Batches and electronic batch records (eBMR): QA release or rejection of a batch — requires batch.approve
- Batches and electronic batch records (eBMR): Raise a deviation from a batch — requires deviation.create
- QC samples and results: Record sample collection — requires qc.sample.collect
- QC samples and results: Enter results — requires qc.result.enter
- QC samples and results: Review results — requires qc.result.review
- QC samples and results: Approve a sample — requires qc.result.approve
- QC samples and results: Replace a result — requires qc.result.enter
- OOS investigations: Record an investigation phase — requires oos.investigate
- OOS investigations: Conclude the investigation (QA) — requires oos.approve
- Deviations: Raise a deviation — requires deviation.create
- Deviations: QA review and classification — requires deviation.approve
- Deviations: Investigate and record the root cause — requires deviation.investigate
- Deviations: CAPA decision and closure — requires deviation.approve
- Deviations: Use the AI investigation assistant — requires ai.assist.use
- CAPA: Create a CAPA — requires capa.create
- CAPA: Complete actions — requires capa.manage
- CAPA: Effectiveness check — requires capa.verify
- CAPA: Close a CAPA — requires capa.close
- Master data: products, materials, suppliers, equipment and specifications: Create or edit a product — requires product.manage
- Master data: products, materials, suppliers, equipment and specifications: Create or edit a material — requires material.manage
- Master data: products, materials, suppliers, equipment and specifications: Create a supplier — requires supplier.manage
- Master data: products, materials, suppliers, equipment and specifications: Change supplier qualification / approve a material — requires supplier.approve or supplier.manage
- Master data: products, materials, suppliers, equipment and specifications: Record equipment calibration — requires equipment.manage

- Your role may additionally be limited to specific sites; records of other sites are then hidden or read-only.
- Never share your password: it is also your electronic-signature credential.
- Sign out or lock your screen when leaving the workstation.


## 17. Practical end-to-end example

Based on the fictional NovaCure demonstration data:

1. Open Copilot and ask “Which CAPAs are overdue?”. The answer lists the CAPAs with links; open one to see owner and due date.


## 18. Frequently asked questions

**Why is the release button disabled?** The server has found release blockers; they are listed on the page with links.

**Can I delete a record I created by mistake?** No. Regulated records are cancelled or corrected with a reason, never deleted.

**Why can I see a module but not its action buttons?** View and action permissions are separate; your role may be read-only for that module.

**Does the AI make decisions?** No. The Copilot and assistants only explain computed facts or draft suggestions; people decide and sign.

**What time zone are dates shown in?** Times are stored in UTC and displayed in Pakistan time (Asia/Karachi) in this release.

**Is this the official batch record?** The executed eBMR in Pharmodry is the electronic record; the printable view is a copy for review. Your SOPs define the official record.


## 19. Glossary

| Term | Meaning |
|---|---|
| ALCOA+ | Data-integrity principles: Attributable, Legible, Contemporaneous, Original, Accurate, plus Complete, Consistent, Enduring, Available. |
| API | Active Pharmaceutical Ingredient. |
| BOM | Bill of materials — quantities of materials per standard batch. |
| CAPA | Corrective and Preventive Action. |
| CoA | Certificate of Analysis from the supplier. |
| Deviation | Departure from an approved instruction or standard. |
| DRAP | Drug Regulatory Authority of Pakistan. |
| eBMR | Electronic Batch Manufacturing Record. |
| E-signature | Electronic signature: password re-entry linked to a record, meaning and reason. |
| FEFO | First Expiry, First Out — earliest-expiring released lots are used first. |
| FG | Finished goods. |
| GMP | Good Manufacturing Practice. |
| GRN | Goods Receipt Note. |
| GS1 / GTIN | Global standards body / Global Trade Item Number used in the 2D DataMatrix. |
| IPC | In-process control. |
| Lot | A quantity of one material or product with one internal lot number at one location. |
| OOS | Out of specification — a result outside its acceptance criteria. |
| OOT | Out of trend. |
| PQR | Product Quality Review (annual review of a product’s quality data). |
| Quarantine | Status of material that may not be used until released by QA. |
| Retest date | Date after which a material must be re-tested before use. |
| SoD | Segregation of duties — the same person may not perform and approve/verify. |
| SOP | Standard Operating Procedure. |
| Yield | Actual output as a percentage of theoretical output. |


## 20. Escalation

Escalate through the roles configured in your company. This release has no built-in external support desk and no vendor contact details; use your company’s documented support and incident procedures.

- Concerns about quality decisions: QA Manager. Operations: Plant Manager.

- Access problems (locked account, missing permission): Company Admin.
- Any suspected data-integrity problem (for example “Integrity failure” on audit verification): QA Manager immediately.
