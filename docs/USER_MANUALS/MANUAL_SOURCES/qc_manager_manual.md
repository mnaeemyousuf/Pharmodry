# Pharmodry — QC Manager User Manual

- Product: Pharmodry 0.1.0 (MVP release)
- Intended audience: Head of the quality control laboratory.
- Document version: 1.0
- Generated: 2026-10-25 (screenshots captured 2026-10-25)
- Role code: QC_MANAGER

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

Manages QC sampling and testing: collects samples, enters, reviews and approves results with e-signature, reports and investigates OOS, raises deviations, manages CAPA actions and maintains specifications.

This manual covers every Pharmodry screen available to the QC Manager role in release 0.1.0. Your exact access is set by your company’s administrator; if your account has additional roles or a site restriction, you may see more or fewer options than described. Configuration-dependent behaviour (for example tolerances, aging thresholds, calibration policy, AI availability) is marked as such.

> **Not available in this release:** Pharmacovigilance, sales/distribution and accounting modules; customer-level distribution in recalls; e-mail notifications; serial-number management; MFA/single sign-on. These are not described as working anywhere in this manual.


## 2. Role responsibilities

- Ensure samples are collected and tested on time.
- Review analysts’ results (never your own) and approve samples.
- Ensure OOS candidates are investigated before approval.
- Maintain QC specifications and test methods.


### Dependencies on other departments

- Warehouse — sample access.
- QA — dispositions and OOS conclusions.


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

![Figure 2](../SCREENSHOTS/qc_manager/profile.png)

*Figure 2 — Profile & security. Profile: password change and active sessions.*


## 4. Home page and dashboard overview

After sign-in you land on My work. It greets you by name and lists the work queues that match your permissions — for example batches awaiting QA release, material lots awaiting disposition, open QC samples, deviations or CAPAs you own, batches on the shop floor, planned batches to prepare and purchase orders awaiting receipt. Each queue links straight to the records. Queues you have no permission for are not shown.

![Figure 3](../SCREENSHOTS/qc_manager/my_work.png)

*Figure 3 — My work (home). Home page with the work queues available to this role.*


### Management dashboard

KPI cards (Active batches, Awaiting QA release, Open deviations, Overdue CAPAs, Open OOS, Materials at high risk, Near-expiry inventory, Plan achievement, Avg batch release time, Supplier quality score) and charts: Production plan vs actual, Batch yield trend (shaded band = configured tolerance), Deviation trend, CAPA aging, OOS trend, Inventory value by status, Near-expiry inventory, Supplier QC rejection rate and Batch release cycle time. All figures are computed from live regulated records.

![Figure 4](../SCREENSHOTS/qc_manager/dashboard.png)

*Figure 4 — Management dashboard. KPI cards and charts computed from live records; click a KPI to drill down.*


## 5. Navigation and module overview

- The left sidebar lists only the modules your role can open, grouped into Overview, Supply & inventory, Production, Quality, Master data and Governance.
- The top bar has global search (“Search batches, lots, deviations, CAPAs…”, shortcut Ctrl K), a “Demo data” badge in demonstration environments, the light/dark theme toggle, the notification bell and your user menu (name and job title).
- Record numbers are links; detail pages show a status badge, key facts, actions you may perform and tabs with history.

The sidebar below was recorded from the application while signed in as the demo QC Manager (qc.manager@novacure.demo).

| Sidebar group | Menu entry | Address |
|---|---|---|
| Overview | My work | / |
| Overview | Dashboard | /dashboard |
| Supply & inventory | Goods receipts | /inventory/receipts |
| Supply & inventory | Inventory | /inventory |
| Supply & inventory | Stock movements | /inventory/movements |
| Production | Batches & eBMR | /production/batches |
| Production | Traceability & recall | /traceability |
| Quality | QC samples | /quality/samples |
| Quality | OOS investigations | /quality/oos |
| Quality | Deviations | /quality/deviations |
| Quality | CAPA | /quality/capa |
| Quality | Product quality review | /quality/pqr |
| Master data | Products | /master-data/products |
| Master data | Materials | /master-data/materials |
| Master data | Equipment | /master-data/equipment |
| Master data | Specifications | /master-data/specifications |


## 6. Features and step-by-step instructions

Each section explains a module you can open, the procedures you are allowed to perform (numbered steps) and screenshots of the real screens. Procedures that need permissions your role does not hold are listed under “Not available to your role”.


### Goods receipts (GRN)

Every receipt line creates a separate lot with its own internal lot number in QUARANTINE and automatically requests a QC sample. Material only becomes usable after QC approval and QA release. Receipts are refused for expired material, for suppliers that are not qualified, for materials not approved for the supplier, and when the expiry date is before the manufacturing date.

![Figure 5](../SCREENSHOTS/qc_manager/grn_list.png)

*Figure 5 — Goods receipts. Goods receipts (GRN). Every line creates a lot in QUARANTINE.*

![Figure 6](../SCREENSHOTS/qc_manager/grn_detail.png)

*Figure 6 — Goods receipt detail. Received lots and their status after a goods receipt.*

> **Not available to your role:** Receive material — requires inventory.receive.


### Inventory, lots and stock movements

Inventory is held per lot and location with a status. Only RELEASED, unexpired lots that are not past retest can be reserved or consumed; quarantined, under-test, rejected, blocked or expired lots never can. Tabs: Lots, Stock by material, Stock-out risk and Expiry intelligence. Every quantity change is written to an append-only ledger (Stock movements).

![Figure 7](../SCREENSHOTS/qc_manager/inventory_list.png)

*Figure 7 — Inventory. Lot-level inventory with status, location and expiry filters.*

![Figure 8](../SCREENSHOTS/qc_manager/inventory_risk.png)

*Figure 8 — Stock-out risk. Stock-out risk by material (released stock vs planned demand and lead time).*

![Figure 9](../SCREENSHOTS/qc_manager/inventory_expiry.png)

*Figure 9 — Expiry intelligence. Expiry intelligence buckets with recommended actions.*

![Figure 10](../SCREENSHOTS/qc_manager/lot_quarantine.png)

*Figure 10 — Lot in quarantine. A quarantined lot: release is blocked until QC approval; blockers are listed.*

![Figure 11](../SCREENSHOTS/qc_manager/lot_released.png)

*Figure 11 — Released lot. A released material lot with available quantity, location and expiry.*

![Figure 12](../SCREENSHOTS/qc_manager/movements.png)

*Figure 12 — Stock movements. Append-only inventory ledger of every movement.*


#### Find a lot

1. Open Inventory.
2. Use the quick views (All on hand, Available (released), Awaiting disposition, Expiring ≤ 30 d / ≤ 60 d / ≤ 90 d, Expired) and the Status, Type and Warehouse filters.
3. Type part of a lot or item name in the table search.
4. Select a lot number to open the lot page (Overview, Movements, QC, Used in batches, Audit trail).

> **Not available to your role:** Release or reject a material lot (QA disposition) — requires inventory.release; Transfer stock — requires inventory.transfer; Post a stock adjustment — requires inventory.adjust; Block or unblock a released lot — requires inventory.release; Export inventory and expiry lists — requires report.export.


### Batches and electronic batch records (eBMR)

Batch lifecycle: Planned → Material reserved → Ready → In progress → Awaiting QC → Awaiting QA → Released / Rejected → Closed (or Cancelled before start). The batch page has tabs Overview, Manufacturing (eBMR), Materials, QC, Deviations, Approvals and Audit trail, and shows GS1 data (GTIN, expiry, batch) for the 2D DataMatrix when the product has a GTIN.

![Figure 13](../SCREENSHOTS/qc_manager/batch_list.png)

*Figure 13 — Batches & eBMR. Batch list with lifecycle status, yield and QA decision.*

![Figure 14](../SCREENSHOTS/qc_manager/batch_released.png)

*Figure 14 — Released batch — overview. Overview of a released batch: yield, finished goods, GS1 data and QA decision.*

![Figure 15](../SCREENSHOTS/qc_manager/batch_ebmr_progress.png)

*Figure 15 — Batch in progress — eBMR. Electronic batch record of a batch in progress: steps, parameters, signatures.*

![Figure 16](../SCREENSHOTS/qc_manager/batch_blocked.png)

*Figure 16 — Batch blocked by OOS. A batch whose release is blocked: failed QC and an open OOS investigation.*

![Figure 17](../SCREENSHOTS/qc_manager/batch_shortage.png)

*Figure 17 — Batch with material shortage. A planned batch that cannot reserve materials because released stock is insufficient.*

![Figure 18](../SCREENSHOTS/qc_manager/batch_record.png)

*Figure 18 — Printable batch record. Print-ready batch manufacturing record (use the browser’s Save as PDF).*


#### Print the batch manufacturing record

1. Open the batch and select Batch record (opens in a new tab).
2. Use Print / the browser’s Save as PDF.


#### Raise a deviation from a batch

1. On the batch page select Raise deviation; the batch is pre-filled.

> **Not available to your role:** Create a batch — requires batch.create; Reserve materials (FEFO) — requires batch.reserve; Issue materials to production — requires inventory.issue; Start the batch — requires batch.start; Execute an eBMR step — requires batch.execute; Verify eBMR steps — requires batch.verify; Record a correction — requires batch.execute or batch.verify; Complete manufacturing — requires batch.complete; QA release or rejection of a batch — requires batch.approve.


### Traceability and mock recall

Backward genealogy (what went into a batch: material lots, suppliers, supplier batches, GRNs and QC release evidence), forward trace (where a material lot went: batches and finished goods) and the mock-recall reconciliation of a batch (produced vs on hand + dispatched − returned ± adjustments/samples, with any unaccounted quantity highlighted). Customer-level distribution is held in the ERP/distribution system and is not captured in this release.

![Figure 19](../SCREENSHOTS/qc_manager/traceability.png)

*Figure 19 — Traceability & mock recall. Mock recall reconciliation of a released batch.*

![Figure 20](../SCREENSHOTS/qc_manager/traceability_backward.png)

*Figure 20 — Backward genealogy. Input material lots with supplier, GRN and QC release evidence.*


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

![Figure 21](../SCREENSHOTS/qc_manager/sample_list.png)

*Figure 21 — QC samples. QC sample list by status and stage.*

![Figure 22](../SCREENSHOTS/qc_manager/sample_detail.png)

*Figure 22 — QC sample detail. A QC sample awaiting collection, with specification tests.*


#### Record sample collection

1. Open the sample (QC samples → Open).
2. Select Record collection, enter Quantity withdrawn (optional) and Remarks in the “Record sample collection” dialog, and confirm.
3. Sampling moves a quarantined lot to UNDER TEST and deducts the sampled quantity.

![Figure 23](../SCREENSHOTS/qc_analyst/wf_sample_requested.png)

*Figure 23 — QC sample requested. A requested sample with the specification tests to perform. (screen captured while signed in as QC Analyst)*

![Figure 24](../SCREENSHOTS/qc_analyst/wf_sample_collect_dialog.png)

*Figure 24 — Record sample collection. Recording sample collection (quantity withdrawn is deducted from the lot). (screen captured while signed in as QC Analyst)*


#### Enter results

1. In Tests & results enter each value (numeric, text or pass/fail) and the Instrument where applicable.
2. Select Save results. Each value is evaluated immediately (within spec / OOS candidate).
3. When all mandatory tests have results select Submit for review. Missing mandatory results are refused.

![Figure 25](../SCREENSHOTS/qc_analyst/wf_sample_results_entry.png)

*Figure 25 — Enter QC results. Result entry: each value is evaluated against the specification snapshot. (screen captured while signed in as QC Analyst)*

![Figure 26](../SCREENSHOTS/qc_analyst/wf_fp_results_entry.png)

*Figure 26 — Finished-product results. Finished-product test results entered against the product specification. (screen captured while signed in as QC Analyst)*


#### Review results

1. Open a SUBMITTED sample.
2. Check results, calculations and raw data.
3. Select Accept review, or Return to analyst with a Comment. You cannot review your own results.

![Figure 27](../SCREENSHOTS/qc_manager/wf_sample_reviewed.png)

*Figure 27 — Sample reviewed. Reviewed sample ready for approval.*


#### Approve a sample

1. Open a REVIEWED sample.
2. Select Approve (e-sign); re-enter your password in the electronic-signature dialog.
3. The conclusion (PASS / FAIL) is recorded. Approval is blocked while an OOS investigation is open (“OOS investigation open — approval and release are blocked”).

![Figure 28](../SCREENSHOTS/qc_manager/wf_sample_approve_signature.png)

*Figure 28 — Approve with electronic signature. Approval requires password re-entry; the signature meaning is recorded.*

![Figure 29](../SCREENSHOTS/qc_manager/wf_sample_approved.png)

*Figure 29 — Sample approved. Approved sample with PASS conclusion.*


#### Replace a result

1. Enter the new value and the Correction reason (required to replace the existing result).
2. The original value is kept; a flagged OOS result cannot be replaced while its investigation is open.


### OOS investigations

Out-of-specification results are reported automatically when a QC result falls outside its specification. The investigation follows fixed phases: Reported → Preliminary investigation → Laboratory investigation (Phase I) → Manufacturing investigation (Phase II) → Root cause → Impact assessment → CAPA → QA approval → Closed. Phases cannot be skipped. The conclusion — CONFIRMED OOS or INVALIDATED (lab error) — is a QA decision with electronic signature; invalidation requires an assignable laboratory error.

![Figure 30](../SCREENSHOTS/qc_manager/oos_list.png)

*Figure 30 — OOS investigations. Out-of-specification investigations with phase and owner.*

![Figure 31](../SCREENSHOTS/qc_manager/oos_detail.png)

*Figure 31 — OOS investigation detail. OOS investigation with phase stepper, linked records and QA conclusion area.*


#### Record an investigation phase

1. Open the OOS investigation.
2. Enter the findings for the current phase in the text field (in Phase I also answer “Was an assignable laboratory error identified?”).
3. Select Complete phase. The stepper moves to the next phase.
4. Link an existing deviation (Link) or select Raise deviation; at the CAPA phase select Create CAPA, or enter a Justification if no CAPA is required.

![Figure 32](../SCREENSHOTS/qa_officer/wf_oos_phase.png)

*Figure 32 — OOS investigation phase. Recording the current OOS investigation phase. (screen captured while signed in as QA Officer)*

> **Not available to your role:** Conclude the investigation (QA) — requires oos.approve.


### Deviations

Draft → Submitted → QA review → Investigation → Root cause → CAPA → Effectiveness check → QA closure. Aging: 0–15 days normal, 16–30 attention, more than 30 overdue (configurable). Root-cause analysis uses structured 5-Whys and a fishbone (6M) category; each save is versioned and QA approves the final root cause.

![Figure 33](../SCREENSHOTS/qc_manager/deviation_list.png)

*Figure 33 — Deviations. Deviation register with classification, aging and owner.*

![Figure 34](../SCREENSHOTS/qc_manager/deviation_detail.png)

*Figure 34 — Deviation detail. Deviation record with workflow actions, RCA, CAPAs and evidence.*


#### Raise a deviation

1. Open Deviations → New (or Raise deviation on a batch, OOS or lot).
2. Under What happened enter Title, Description, Immediate action taken, Occurred at and optionally a Proposed severity.
3. Under Where & what is affected choose Site, Process stage and any Batch, Product, Material or Equipment.
4. Save as draft (then Submit to QA from the deviation page) or submit directly. Record what happened as soon as possible — QA classifies severity during review.

![Figure 35](../SCREENSHOTS/qa_officer/wf_deviation_create_form.png)

*Figure 35 — Raise a deviation. Deviation form: what happened, immediate action and affected records. (screen captured while signed in as QA Officer)*

![Figure 36](../SCREENSHOTS/qa_officer/wf_deviation_submitted.png)

*Figure 36 — Deviation submitted. Submitted deviation awaiting QA review. (screen captured while signed in as QA Officer)*


#### Use the AI investigation assistant

1. On the deviation page open AI investigation assistant.
2. Review similar historical cases (computed by Pharmodry) and any suggested areas to investigate.
3. Nothing is written to the record; copy only what you agree with into your own investigation.

> **Not available to your role:** QA review and classification — requires deviation.approve; Investigate and record the root cause — requires deviation.investigate; CAPA decision and closure — requires deviation.approve.


### CAPA

Corrective and preventive actions from deviations, OOS, OOT, audits, complaints, supplier issues and recalls. Each CAPA has actions with owners and due dates, effectiveness criteria and an effectiveness check. Closure requires a successful effectiveness check and a QA electronic signature; a failed check returns the CAPA to In Progress and is counted in the effectiveness-failure KPI.

![Figure 37](../SCREENSHOTS/qc_manager/capa_list.png)

*Figure 37 — CAPA. CAPA register with priority, owner and due date.*

![Figure 38](../SCREENSHOTS/qc_manager/capa_detail.png)

*Figure 38 — CAPA detail. CAPA with actions, effectiveness check and closure.*


#### Complete actions

1. Open the CAPA, select Mark complete on an action and record Objective evidence in the “Complete action” dialog.
2. Add action adds further actions while the CAPA is open or in progress.

> **Not available to your role:** Create a CAPA — requires capa.create; Effectiveness check — requires capa.verify; Close a CAPA — requires capa.close.


### Product Quality Review (PQR) data pack

Figures computed for the PIC/S GMP Chapter 1 product quality review: batches manufactured with yield statistics, finished-product QC results (approved samples), deviations, OOS investigations, CAPAs and starting materials with suppliers. QA authors the evaluation and conclusions. Sections not captured in this release (for example stability, complaints, returns, change control) are listed so they can be added from source systems.

![Figure 39](../SCREENSHOTS/qc_manager/pqr.png)

*Figure 39 — Product Quality Review. Product Quality Review data pack for a product and period.*


#### Prepare a PQR data pack

1. Open Product quality review.
2. Choose Product, From and To dates.
3. Review sections 1–6 and the “Sections not captured in this release” notice.
4. Select Print / PDF to save the pack.


### Master data: products, materials, suppliers, equipment and specifications

Regulated master data is versioned: every change requires a reason and creates a new immutable version (Version history). Products carry registration, shelf life, storage, GTIN (GS1, check digit verified), BOM and manufacturing template; materials carry type, retest period, safety stock and lead time; suppliers carry qualification status, approved materials and certifications; equipment carries calibration frequency and history; specifications hold versioned acceptance criteria.

![Figure 40](../SCREENSHOTS/qc_manager/products.png)

*Figure 40 — Products. Product master list with GTIN and registration.*

![Figure 41](../SCREENSHOTS/qc_manager/product_detail.png)

*Figure 41 — Product detail. Product detail: BOM, manufacturing template, specifications and versions.*

![Figure 42](../SCREENSHOTS/qc_manager/materials.png)

*Figure 42 — Materials. Material master with released and quarantined stock.*

![Figure 43](../SCREENSHOTS/qc_manager/material_detail.png)

*Figure 43 — Material detail. Material detail: lots in FEFO order, approved suppliers, specifications.*

![Figure 44](../SCREENSHOTS/qc_manager/equipment.png)

*Figure 44 — Equipment & calibration. Equipment list with calibration status.*

![Figure 45](../SCREENSHOTS/qc_manager/equipment_detail.png)

*Figure 45 — Equipment detail. Equipment detail with calibration history.*

![Figure 46](../SCREENSHOTS/qc_manager/specifications.png)

*Figure 46 — QC specifications. Versioned QC specifications.*

![Figure 47](../SCREENSHOTS/qc_manager/specification_detail.png)

*Figure 47 — Specification detail. Specification tests and acceptance criteria.*

> **Not available to your role:** Create or edit a product — requires product.manage; Create or edit a material — requires material.manage; Create a supplier — requires supplier.manage; Change supplier qualification / approve a material — requires supplier.approve or supplier.manage; Record equipment calibration — requires equipment.manage.


## 7. Field-by-field explanations, required inputs and validation rules

General rules: required fields are marked; dates use the date picker; numbers must be positive unless stated; reasons must be at least 5 characters; unknown or malformed inputs are rejected by the server. Forms that you cannot submit are still shown for reference where you can view the module.


### Batches and electronic batch records (eBMR)

| Field | Required | Rules and meaning |
|---|---|---|
| Product | Yes | Active product with an active BOM and manufacturing template. |
| Production plan line | No | Plan must be APPROVED. |
| Batch size | Yes | Material quantities are scaled from the BOM. |
| Planned start | Yes | Date/time. |
| Equipment (step start) | If required | Qualified and calibrated equipment only. |
| Process parameters / IPC readings | Yes | Checked against limits; out-of-limit flagged. |
| Yield justification | If out of tolerance | At least 10 characters, or link a deviation. |


### Deviations

| Field | Required | Rules and meaning |
|---|---|---|
| Title | Yes | Short summary. |
| Description | Yes | At least 10 characters. |
| Immediate action taken | Recommended | Containment actions. |
| Occurred at | Yes | Date and time (local). |
| Proposed severity | No | QA decides the classification. |
| Site / Process stage | Yes | Where it happened. |
| Batch / Product / Material / Equipment | No | Links affected records. |


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
| QC samples and results | Record collection | Records collection and sampled quantity. | Yes |
| QC samples and results | Save results | Stores and evaluates results. | Yes |
| QC samples and results | Submit for review | Sends results for review. | Yes |
| QC samples and results | Accept review / Return to analyst | Second-person review or return to analyst. | Yes |
| QC samples and results | Approve (e-sign) | Approval with electronic signature. | Yes |

Buttons you cannot use are hidden or disabled in the application; the server refuses the action even if attempted another way.


## 9. Workflow, approvals and electronic signatures

The table shows the main GMP workflow and where your role takes part. Segregation of duties is enforced by the server: the person who performs a step cannot review, verify or approve it.

| Workflow step | Permission | Your role |
|---|---|---|
| Raise purchase order | procurement.po.create | — |
| Approve purchase order (different person) | procurement.po.approve | — |
| Receive goods (GRN) → lots in QUARANTINE, QC sample requested | inventory.receive | — |
| Collect sample and enter results | qc.result.enter | You perform this |
| Review results (different person) | qc.result.review | You perform this |
| Approve QC sample (e-signature) | qc.result.approve | You perform this |
| QA disposition of material lot (e-signature) | inventory.release | — |
| Create / approve production plan | production.plan.manage | — |
| Create batch | batch.create | — |
| Reserve materials (FEFO, released lots only) | batch.reserve | — |
| Issue materials to production | inventory.issue | — |
| Start batch | batch.start | — |
| Execute and sign eBMR steps | batch.execute | — |
| Verify eBMR steps (different person, e-signature) | batch.verify | — |
| Complete manufacturing (yield, FG to QUARANTINE) | batch.complete | — |
| Finished-product QC (enter / review / approve) | qc.result.enter | You perform this |
| QA batch release or rejection (e-signature) | batch.approve | — |
| Raise deviation | deviation.create | You perform this |
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
| PLANNED | Batch created; materials not yet reserved. |
| MATERIAL RESERVED | Released lots reserved (FEFO). |
| READY | Materials issued; batch can start. |
| IN PROGRESS | Manufacturing in progress (batch, step or CAPA). |
| AWAITING QC | Manufacturing complete; finished-product QC pending. |
| AWAITING QA | QC complete; QA decision pending. |
| CLOSED | Completed and closed. |
| PENDING | eBMR step not started. |
| VERIFIED | eBMR step verified by a second person. |
| REQUESTED | QC sample requested. |
| COLLECTED | Sample collected. |
| IN TESTING | Results being entered. |
| SUBMITTED | Submitted for review. |
| REVIEWED | Reviewed; awaiting approval. |
| APPROVED | Approved (sample, supplier, PO or plan). |
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
| DRAFT | Draft, not yet submitted/approved. |
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
| Mock-recall reconciliation (CSV) | Traceability & recall → Export recall reconciliation | View only — export needs report.export |
| Product Quality Review data pack (print / PDF) | Product quality review → Print / PDF | Yes (print) |

Every export is recorded in the audit trail. CSV files are UTF-8 and protected against spreadsheet formula injection.


## 13. Notifications and alerts

- The bell shows unread notifications; Notifications → Inbox lists them and Mark all read clears the counter.
- Alerts come from workflows (for example QC sample requested, OOS reported, batch awaiting QA, assignment) and scheduled compliance scans (expiry, low stock, overdue CAPAs/deviations, calibration due, QA backlog).
- My preferences lets you choose which notifications you receive. In-app delivery is on by default; e-mail delivery requires SMTP configuration by an administrator and is not active in this release.

![Figure 48](../SCREENSHOTS/qc_manager/notifications.png)

*Figure 48 — Notifications. Notification inbox and preferences.*


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
| ai.assist.use | Use AI investigation and CAPA assistants |
| analytics.view | View dashboards and analytics |
| batch.view | View batches and eBMR |
| capa.manage | Update CAPA actions and evidence |
| capa.view | View CAPAs |
| deviation.create | Raise deviations |
| deviation.view | View deviations |
| inventory.view | View inventory lots and movements |
| masterdata.view | View master data |
| oos.create | Report OOS investigations |
| oos.investigate | Record OOS investigation phases |
| oos.view | View OOS investigations |
| qc.result.approve | Approve QC samples |
| qc.result.enter | Enter analytical results |
| qc.result.review | Review analytical results |
| qc.sample.collect | Record sample collection |
| qc.sample.create | Request QC samples |
| qc.view | View QC samples and results |
| spec.manage | Manage QC specifications and test methods |

Not granted (40 permissions): admin.tenant.manage, admin.site.manage, admin.user.manage, admin.role.manage, product.manage, material.manage, supplier.view, supplier.manage, supplier.approve, equipment.manage, procurement.po.view, procurement.po.create, procurement.po.approve, inventory.receive, inventory.transfer, inventory.adjust, inventory.issue, inventory.release, production.plan.view, production.plan.manage, production.plan.approve, batch.create, batch.reserve, batch.start, batch.execute, batch.verify, batch.complete, batch.approve, oos.approve, deviation.investigate, deviation.approve, capa.create, capa.verify, capa.close, audit.view, audit.export, commandcenter.view, report.export, ai.copilot.use, ai.admin.


### Procedures you cannot perform

- Goods receipts (GRN): Receive material — requires inventory.receive
- Inventory, lots and stock movements: Release or reject a material lot (QA disposition) — requires inventory.release
- Inventory, lots and stock movements: Transfer stock — requires inventory.transfer
- Inventory, lots and stock movements: Post a stock adjustment — requires inventory.adjust
- Inventory, lots and stock movements: Block or unblock a released lot — requires inventory.release
- Inventory, lots and stock movements: Export inventory and expiry lists — requires report.export
- Batches and electronic batch records (eBMR): Create a batch — requires batch.create
- Batches and electronic batch records (eBMR): Reserve materials (FEFO) — requires batch.reserve
- Batches and electronic batch records (eBMR): Issue materials to production — requires inventory.issue
- Batches and electronic batch records (eBMR): Start the batch — requires batch.start
- Batches and electronic batch records (eBMR): Execute an eBMR step — requires batch.execute
- Batches and electronic batch records (eBMR): Verify eBMR steps — requires batch.verify
- Batches and electronic batch records (eBMR): Record a correction — requires batch.execute or batch.verify
- Batches and electronic batch records (eBMR): Complete manufacturing — requires batch.complete
- Batches and electronic batch records (eBMR): QA release or rejection of a batch — requires batch.approve
- OOS investigations: Conclude the investigation (QA) — requires oos.approve
- Deviations: QA review and classification — requires deviation.approve
- Deviations: Investigate and record the root cause — requires deviation.investigate
- Deviations: CAPA decision and closure — requires deviation.approve
- CAPA: Create a CAPA — requires capa.create
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

1. An analyst submits results for an excipient sample.
2. Open the sample, check results and select Accept review; then Approve (e-sign).
3. The sample is APPROVED with conclusion PASS and the lot appears as ready for QA disposition.


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

- OOS results: QA (investigation and conclusion). Instrument failures: Engineering. Specification changes: QA Manager.

- Access problems (locked account, missing permission): Company Admin.
- Any suspected data-integrity problem (for example “Integrity failure” on audit verification): QA Manager immediately.
