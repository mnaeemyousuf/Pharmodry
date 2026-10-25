# Pharmodry — Super Admin User Manual

- Product: Pharmodry 0.1.0 (MVP release)
- Intended audience: IT / systems head responsible for the Pharmodry platform at company level.
- Document version: 1.0
- Generated: 2026-10-25 (screenshots captured 2026-10-25)
- Role code: SUPER_ADMIN

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

Holds every permission in the application. Intended for platform administration, configuration and emergency support — not for routine GMP work, where segregation of duties requires named role holders.

This manual covers every Pharmodry screen available to the Super Admin role in release 0.1.0. Your exact access is set by your company’s administrator; if your account has additional roles or a site restriction, you may see more or fewer options than described. Configuration-dependent behaviour (for example tolerances, aging thresholds, calibration policy, AI availability) is marked as such.

> **Not available in this release:** Pharmacovigilance, sales/distribution and accounting modules; customer-level distribution in recalls; e-mail notifications; serial-number management; MFA/single sign-on. These are not described as working anywhere in this manual.


## 2. Role responsibilities

- Configure the company, sites, warehouses, departments and policies.
- Create users, assign roles and site scopes, unlock accounts.
- Maintain the role and permission matrix.
- Monitor AI usage and governance settings.
- Verify audit-trail integrity and respond to integrity alerts.
- Avoid performing GMP approvals personally; where unavoidable, the system still enforces segregation of duties and records your signature.


### Dependencies on other departments

- QA Manager — approves which roles may perform GMP approvals.
- Company Admin — day-to-day user administration.


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

![Figure 2](../SCREENSHOTS/super_admin/profile.png)

*Figure 2 — Profile & security. Profile: password change and active sessions.*


## 4. Home page and dashboard overview

After sign-in you land on My work. It greets you by name and lists the work queues that match your permissions — for example batches awaiting QA release, material lots awaiting disposition, open QC samples, deviations or CAPAs you own, batches on the shop floor, planned batches to prepare and purchase orders awaiting receipt. Each queue links straight to the records. Queues you have no permission for are not shown.

![Figure 3](../SCREENSHOTS/super_admin/my_work.png)

*Figure 3 — My work (home). Home page with the work queues available to this role.*


### Pharma Command Center

The Command Center answers “what needs attention right now, why, which process it affects, who owns it and how long it has been pending”. Items are grouped into Batches at risk, Quality issues, Materials at risk, Inventory risks, Compliance deadlines and Supplier risks, and each carries a severity (Critical, Warning, Info), owner, age and a link to the record. It also lists serialization-readiness gaps such as active products without a GTIN.

![Figure 4](../SCREENSHOTS/super_admin/command_center.png)

*Figure 4 — Command Center. Exception-driven Command Center: what needs attention, why, owner and age.*


### Management dashboard

KPI cards (Active batches, Awaiting QA release, Open deviations, Overdue CAPAs, Open OOS, Materials at high risk, Near-expiry inventory, Plan achievement, Avg batch release time, Supplier quality score) and charts: Production plan vs actual, Batch yield trend (shaded band = configured tolerance), Deviation trend, CAPA aging, OOS trend, Inventory value by status, Near-expiry inventory, Supplier QC rejection rate and Batch release cycle time. All figures are computed from live regulated records.

![Figure 5](../SCREENSHOTS/super_admin/dashboard.png)

*Figure 5 — Management dashboard. KPI cards and charts computed from live records; click a KPI to drill down.*


## 5. Navigation and module overview

- The left sidebar lists only the modules your role can open, grouped into Overview, Supply & inventory, Production, Quality, Master data and Governance.
- The top bar has global search (“Search batches, lots, deviations, CAPAs…”, shortcut Ctrl K), a “Demo data” badge in demonstration environments, the light/dark theme toggle, the notification bell and your user menu (name and job title).
- Record numbers are links; detail pages show a status badge, key facts, actions you may perform and tabs with history.

The sidebar below was recorded from the application while signed in as the demo Super Admin (super.admin@novacure.demo).

| Sidebar group | Menu entry | Address |
|---|---|---|
| Overview | My work | / |
| Overview | Command Center | /command-center |
| Overview | Dashboard | /dashboard |
| Overview | Copilot | /copilot |
| Supply & inventory | Purchase orders | /procurement/purchase-orders |
| Supply & inventory | Goods receipts | /inventory/receipts |
| Supply & inventory | Inventory | /inventory |
| Supply & inventory | Stock movements | /inventory/movements |
| Production | Production plans | /production/plans |
| Production | Batches & eBMR | /production/batches |
| Production | Traceability & recall | /traceability |
| Quality | QA release | /quality/release |
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
| Governance | Audit trail | /audit-trail |
| Governance | Reports | /reports |
| Governance | Users | /admin/users |
| Governance | Roles & permissions | /admin/roles |
| Governance | Organisation | /admin/organization |
| Governance | AI governance | /admin/ai |


## 6. Features and step-by-step instructions

Each section explains a module you can open, the procedures you are allowed to perform (numbered steps) and screenshots of the real screens. Procedures that need permissions your role does not hold are listed under “Not available to your role”.


### Copilot (AI assistant)

Ask questions in plain language about batches, quality events, inventory and suppliers — for example “Which CAPAs are overdue?”, “Which batches are awaiting QA release?”, “Which materials are at risk of stock-out?”. Pharmodry computes the figures from live records you are allowed to see; the AI model only explains them and lists citations (links to the records). The Copilot cannot approve, release or change any record.

> **Note:** If the banner “AI provider not configured” appears, the server has no Mistral API key: you still receive the computed facts and links, but no prose explanation. This is configuration-dependent.

> **Note:** If you ask about data you have no permission for, the Copilot tells you which permission is required instead of answering.

![Figure 6](../SCREENSHOTS/super_admin/copilot.png)

*Figure 6 — Copilot. Copilot question box. Answers are computed by Pharmodry; the AI only explains them.*


#### Ask the Copilot

1. Open Copilot from the sidebar.
2. Type your question in “Ask a question about your operation…” and select Send.
3. Read the answer and open the cited records to verify.
4. Rate the answer with Thumbs up / Thumbs down to help administrators monitor quality.


### Purchase orders

Purchase orders may only be raised with qualified suppliers (APPROVED or CONDITIONALLY APPROVED) for materials on that supplier’s approved list. A new order is a DRAFT until a different user approves it.

![Figure 7](../SCREENSHOTS/super_admin/po_list.png)

*Figure 7 — Purchase orders. Purchase order list with status, supplier and value.*

![Figure 8](../SCREENSHOTS/super_admin/po_detail.png)

*Figure 8 — Purchase order detail. Purchase order detail with lines, approval and audit trail.*


#### Create a purchase order

1. Open Purchase orders and select New purchase order.
2. Choose the Site and the Supplier (suspended or blacklisted suppliers are disabled in the list).
3. Optionally enter Expected delivery and Notes.
4. Select Add line; choose a Material (only materials approved for this supplier are listed), enter Quantity and Unit price (PKR).
5. Check the Total and select Create purchase order. The order is created as a draft.

![Figure 9](../SCREENSHOTS/procurement_officer/wf_po_create_form.png)

*Figure 9 — Create a purchase order. New purchase order: approved supplier, approved material, quantity and price. (screen captured while signed in as Procurement Officer)*

![Figure 10](../SCREENSHOTS/procurement_officer/wf_po_draft.png)

*Figure 10 — Purchase order in draft. The new order is a draft until a different user approves it. (screen captured while signed in as Procurement Officer)*


#### Approve a purchase order

1. Open the draft order.
2. Check supplier, lines, quantities and value.
3. Select Approve. You cannot approve an order you created yourself.

![Figure 11](../SCREENSHOTS/procurement_manager/wf_po_awaiting_approval.png)

*Figure 11 — Approve a purchase order. Draft order awaiting approval by the procurement manager. (screen captured while signed in as Procurement Manager)*

![Figure 12](../SCREENSHOTS/procurement_manager/wf_po_approved.png)

*Figure 12 — Approved purchase order. Approved order, ready for goods receipt. (screen captured while signed in as Procurement Manager)*


#### Cancel a purchase order

1. Open the order and select Cancel order.
2. Enter a reason and confirm. Cancelled orders stay on record.


### Goods receipts (GRN)

Every receipt line creates a separate lot with its own internal lot number in QUARANTINE and automatically requests a QC sample. Material only becomes usable after QC approval and QA release. Receipts are refused for expired material, for suppliers that are not qualified, for materials not approved for the supplier, and when the expiry date is before the manufacturing date.

![Figure 13](../SCREENSHOTS/super_admin/grn_list.png)

*Figure 13 — Goods receipts. Goods receipts (GRN). Every line creates a lot in QUARANTINE.*

![Figure 14](../SCREENSHOTS/super_admin/grn_detail.png)

*Figure 14 — Goods receipt detail. Received lots and their status after a goods receipt.*


#### Receive material

1. Open Goods receipts and select New.
2. Choose the Site and the Supplier; optionally choose the Purchase order and select Load lines to copy its lines.
3. Enter the Delivery note / DN number and any Remarks.
4. For each container lot select Add line and enter Material, Supplier batch, Quantity, Containers, Mfg date, Expiry date, Retest date (if applicable), Warehouse and Bin — exactly as on the container labels and certificate of analysis.
5. Select Create GRN. The confirmation shows the GRN number, the lots created in QUARANTINE and the QC samples requested.
6. Label and store the containers in the quarantine area according to your site SOP.

![Figure 15](../SCREENSHOTS/warehouse_officer/wf_grn_create_form.png)

*Figure 15 — Create a goods receipt. Goods receipt form: supplier, delivery note and one line per supplier batch. (screen captured while signed in as Warehouse Officer)*

![Figure 16](../SCREENSHOTS/warehouse_officer/wf_grn_created.png)

*Figure 16 — Goods receipt created. Receipt created: the lot is in QUARANTINE and a QC sample was requested automatically. (screen captured while signed in as Warehouse Officer)*


### Inventory, lots and stock movements

Inventory is held per lot and location with a status. Only RELEASED, unexpired lots that are not past retest can be reserved or consumed; quarantined, under-test, rejected, blocked or expired lots never can. Tabs: Lots, Stock by material, Stock-out risk and Expiry intelligence. Every quantity change is written to an append-only ledger (Stock movements).

![Figure 17](../SCREENSHOTS/super_admin/inventory_list.png)

*Figure 17 — Inventory. Lot-level inventory with status, location and expiry filters.*

![Figure 18](../SCREENSHOTS/super_admin/inventory_risk.png)

*Figure 18 — Stock-out risk. Stock-out risk by material (released stock vs planned demand and lead time).*

![Figure 19](../SCREENSHOTS/super_admin/inventory_expiry.png)

*Figure 19 — Expiry intelligence. Expiry intelligence buckets with recommended actions.*

![Figure 20](../SCREENSHOTS/super_admin/lot_quarantine.png)

*Figure 20 — Lot in quarantine. A quarantined lot: release is blocked until QC approval; blockers are listed.*

![Figure 21](../SCREENSHOTS/super_admin/lot_released.png)

*Figure 21 — Released lot. A released material lot with available quantity, location and expiry.*

![Figure 22](../SCREENSHOTS/super_admin/movements.png)

*Figure 22 — Stock movements. Append-only inventory ledger of every movement.*


#### Find a lot

1. Open Inventory.
2. Use the quick views (All on hand, Available (released), Awaiting disposition, Expiring ≤ 30 d / ≤ 60 d / ≤ 90 d, Expired) and the Status, Type and Warehouse filters.
3. Type part of a lot or item name in the table search.
4. Select a lot number to open the lot page (Overview, Movements, QC, Used in batches, Audit trail).


#### Release or reject a material lot (QA disposition)

1. Open the lot (or use QA release → Material lots awaiting disposition).
2. If the page shows “This lot cannot be released yet”, read the listed blockers (for example QC not approved). Release stays disabled until they are cleared.
3. When the page shows “Ready for QA disposition”, check the QC result, supplier and CoA.
4. Select QA release (or Reject). In the electronic-signature dialog enter a reason where required and re-enter your password, then sign.
5. The lot status changes to RELEASED (usable) or REJECTED (segregate physically per SOP).

![Figure 23](../SCREENSHOTS/qa_officer/wf_lot_release_blocked_annotated.png)

*Figure 23 — Lot release blocked before QC. Release is disabled; the blockers explain what is missing (QC approval). (screen captured while signed in as QA Officer)*

1. Lot status (QUARANTINE)
2. Release blockers, with links to the missing step
3. QA release — disabled until every blocker is cleared

![Figure 24](../SCREENSHOTS/qa_officer/wf_lot_ready.png)

*Figure 24 — Lot ready for QA disposition. QC approved: the lot can now be released or rejected by QA. (screen captured while signed in as QA Officer)*

![Figure 25](../SCREENSHOTS/qa_officer/wf_lot_release_signature.png)

*Figure 25 — Release a lot with e-signature. QA disposition requires an electronic signature. (screen captured while signed in as QA Officer)*

![Figure 26](../SCREENSHOTS/qa_officer/wf_lot_released.png)

*Figure 26 — Lot released. The lot is RELEASED and can be reserved by production (FEFO). (screen captured while signed in as QA Officer)*


#### Transfer stock

1. Open the lot and select Transfer.
2. Choose the Destination warehouse and Bin, enter Quantity and Reason.
3. Select Transfer. The ledger records a TRANSFER_OUT and TRANSFER_IN.


#### Post a stock adjustment

1. Open the lot and select Adjust.
2. Enter the Quantity change (signed) — negative to reduce stock (damage, count variance) — and a Reason.
3. Select Post adjustment. Adjustments are audited with your reason.


#### Block or unblock a released lot

1. Open a RELEASED lot and select Block (or Unblock on a BLOCKED lot).
2. Enter the reason and confirm. Blocked lots cannot be reserved or issued.


#### Export inventory and expiry lists

1. Use Export CSV on the lot table, or the download on Expiry intelligence.
2. The export is recorded in the audit trail.


### Production plans

A production plan holds, per product, the planned quantity and number of batches for a period. Achievement = released batch output ÷ planned quantity. Plan detail shows feasibility (Feasible / Shortage) per line based on released stock.

![Figure 27](../SCREENSHOTS/super_admin/plan_list.png)

*Figure 27 — Production plans. Production plans with achievement against released output.*

![Figure 28](../SCREENSHOTS/super_admin/plan_detail.png)

*Figure 28 — Production plan detail. Plan lines with material feasibility and batch creation.*


#### Create a production plan

1. Open Production plans and select New production plan.
2. Choose Site, enter Name, Period start and Period end.
3. Add product lines: Product, Batches and Planned quantity (defaults to batches × standard batch size).
4. Select Create plan. The plan is created as DRAFT.


#### Approve a plan

1. Open the draft plan.
2. Review lines and feasibility.
3. Select Approve plan.


#### Create a batch from a plan line

1. Open an approved plan.
2. Select Create batch on the line. The batch number is generated by the configured rule and the eBMR is copied from the active manufacturing template.


### Batches and electronic batch records (eBMR)

Batch lifecycle: Planned → Material reserved → Ready → In progress → Awaiting QC → Awaiting QA → Released / Rejected → Closed (or Cancelled before start). The batch page has tabs Overview, Manufacturing (eBMR), Materials, QC, Deviations, Approvals and Audit trail, and shows GS1 data (GTIN, expiry, batch) for the 2D DataMatrix when the product has a GTIN.

![Figure 29](../SCREENSHOTS/super_admin/batch_list.png)

*Figure 29 — Batches & eBMR. Batch list with lifecycle status, yield and QA decision.*

![Figure 30](../SCREENSHOTS/super_admin/batch_released.png)

*Figure 30 — Released batch — overview. Overview of a released batch: yield, finished goods, GS1 data and QA decision.*

![Figure 31](../SCREENSHOTS/super_admin/batch_ebmr_progress.png)

*Figure 31 — Batch in progress — eBMR. Electronic batch record of a batch in progress: steps, parameters, signatures.*

![Figure 32](../SCREENSHOTS/super_admin/batch_blocked.png)

*Figure 32 — Batch blocked by OOS. A batch whose release is blocked: failed QC and an open OOS investigation.*

![Figure 33](../SCREENSHOTS/super_admin/batch_shortage.png)

*Figure 33 — Batch with material shortage. A planned batch that cannot reserve materials because released stock is insufficient.*

![Figure 34](../SCREENSHOTS/super_admin/batch_record.png)

*Figure 34 — Printable batch record. Print-ready batch manufacturing record (use the browser’s Save as PDF).*


#### Create a batch

1. Open Batches & eBMR and select New (or Create batch on a plan line).
2. Choose Site, Product, optional Production plan line, Batch size and Planned start.
3. Check Material availability: “All materials available” or “Shortage — reservation will be blocked”. Only released, unexpired stock net of reservations counts.
4. Select Create batch. The number follows the configured pattern (e.g. PCM-2026-000123).

![Figure 35](../SCREENSHOTS/supply_chain_planner/wf_batch_create_form.png)

*Figure 35 — Create a batch. New batch form with live material availability (released stock only). (screen captured while signed in as Supply Chain Planner)*

![Figure 36](../SCREENSHOTS/supply_chain_planner/wf_batch_planned.png)

*Figure 36 — Batch planned. A planned batch; the next step is FEFO material reservation. (screen captured while signed in as Supply Chain Planner)*


#### Reserve materials (FEFO)

1. Open the PLANNED batch and select Reserve materials.
2. Pharmodry reserves RELEASED lots in first-expiry-first-out order. If stock is insufficient the action is refused.
3. Release reservation returns reserved quantities (with a reason) if the batch will not proceed.

![Figure 37](../SCREENSHOTS/supply_chain_planner/wf_batch_reserved.png)

*Figure 37 — Materials reserved (FEFO). Reserved lots in first-expiry-first-out order. (screen captured while signed in as Supply Chain Planner)*


#### Issue materials to production

1. Open the MATERIAL RESERVED batch and select Issue materials.
2. Lots are re-checked (released, unexpired). The batch becomes READY.

![Figure 38](../SCREENSHOTS/warehouse_officer/wf_batch_issue.png)

*Figure 38 — Issue materials to a batch. Issuing reserved materials to production. (screen captured while signed in as Warehouse Officer)*


#### Start the batch

1. Open the READY batch and select Start batch. The batch is IN PROGRESS and eBMR steps can be executed.

![Figure 39](../SCREENSHOTS/production_supervisor/wf_batch_ready.png)

*Figure 39 — Batch ready to start. Materials issued; the supervisor starts the batch. (screen captured while signed in as Production Supervisor)*


#### Execute an eBMR step

1. Open the batch and the Manufacturing (eBMR) tab. Steps must be done in order.
2. Select Start on the next step (enabled only when the previous step is done) and choose the equipment. Equipment must be qualified and within calibration; expired calibration is blocked (or, under WARN policy, needs an Override reason).
3. Perform the operation per the master instructions.
4. Select Record & sign, enter every process parameter and in-process control reading. Out-of-limit readings are flagged (“Out-of-limit reading”).
5. Enter Remarks if needed, re-enter your password and sign.

![Figure 40](../SCREENSHOTS/production_operator/wf_ebmr_complete_disp.png)

*Figure 40 — Complete and sign step DISP. Recording parameters and in-process checks, then signing the step. (screen captured while signed in as Production Operator)*

![Figure 41](../SCREENSHOTS/production_operator/wf_ebmr_complete_comp.png)

*Figure 41 — Complete and sign step COMP. Recording parameters and in-process checks, then signing the step. (screen captured while signed in as Production Operator)*

![Figure 42](../SCREENSHOTS/production_operator/wf_ebmr_all_completed.png)

*Figure 42 — All steps completed. All eBMR steps completed and signed; awaiting supervisor verification. (screen captured while signed in as Production Operator)*


#### Verify eBMR steps

1. Open the Manufacturing (eBMR) tab.
2. Review each completed step’s readings and signature.
3. Select Verify and sign the electronic signature. You cannot verify a step you performed yourself.

![Figure 43](../SCREENSHOTS/production_supervisor/wf_ebmr_verify_signature.png)

*Figure 43 — Verify a step with e-signature. Supervisor verification of an operator step (a different person must verify). (screen captured while signed in as Production Supervisor)*

![Figure 44](../SCREENSHOTS/production_supervisor/wf_ebmr_verified.png)

*Figure 44 — All steps verified. Every step verified; the batch can be completed. (screen captured while signed in as Production Supervisor)*


#### Record a correction

1. On a completed step select Correct.
2. Choose the Field, enter the New value and the Reason for correction.
3. Select Record correction. The original value, new value, reason and your identity are kept; a verified step returns to COMPLETED and must be re-verified.


#### Complete manufacturing

1. When all steps are verified select Complete manufacturing.
2. Review the Calculated yield against the tolerance. If it is outside tolerance you must select a Linked deviation (recommended) or enter a documented justification.
3. Confirm. Finished goods are booked into QUARANTINE and a finished-product QC sample is requested; the batch is AWAITING QC.

![Figure 45](../SCREENSHOTS/production_manager/wf_batch_complete_dialog.png)

*Figure 45 — Complete manufacturing. Completion shows the calculated yield against tolerance. (screen captured while signed in as Production Manager)*

![Figure 46](../SCREENSHOTS/production_manager/wf_batch_awaiting_qc.png)

*Figure 46 — Batch awaiting QC. Finished goods in QUARANTINE; finished-product QC requested. (screen captured while signed in as Production Manager)*


#### QA release or rejection of a batch

1. Open the batch (or QA release → Batches awaiting QC / QA).
2. If “QA release is blocked” appears, the reasons list what is missing: pending or failed QC, open or confirmed OOS, open deviations, unverified steps, unjustified yield.
3. When “Ready for QA release” appears, review the batch record (Batch record button), QC results, deviations and yield.
4. Select QA release (or Reject), enter the reason and re-enter your password to sign.
5. On release the finished-goods lot becomes RELEASED. Close batch archives a released or rejected batch.

![Figure 47](../SCREENSHOTS/qa_manager/wf_batch_ready_release_annotated.png)

*Figure 47 — Batch ready for QA release. All release checks satisfied; QA can release or reject. (screen captured while signed in as QA Manager)*

1. Server-side release checks all satisfied
2. QA release (opens the electronic signature)
3. Reject (reason and signature required)
4. Audit trail of the batch

![Figure 48](../SCREENSHOTS/qa_manager/wf_batch_release_signature_annotated.png)

*Figure 48 — Release a batch with e-signature. QA batch release with reason and password re-entry. (screen captured while signed in as QA Manager)*

1. Meaning of the signature, recorded with it
2. Reason / comment
3. Re-enter your password (re-authentication)
4. Sign and release

![Figure 49](../SCREENSHOTS/qa_manager/wf_batch_released.png)

*Figure 49 — Batch released. Released batch; finished goods are now RELEASED. (screen captured while signed in as QA Manager)*


#### Print the batch manufacturing record

1. Open the batch and select Batch record (opens in a new tab).
2. Use Print / the browser’s Save as PDF.


#### Raise a deviation from a batch

1. On the batch page select Raise deviation; the batch is pre-filled.


### Traceability and mock recall

Backward genealogy (what went into a batch: material lots, suppliers, supplier batches, GRNs and QC release evidence), forward trace (where a material lot went: batches and finished goods) and the mock-recall reconciliation of a batch (produced vs on hand + dispatched − returned ± adjustments/samples, with any unaccounted quantity highlighted). Customer-level distribution is held in the ERP/distribution system and is not captured in this release.

![Figure 50](../SCREENSHOTS/super_admin/traceability.png)

*Figure 50 — Traceability & mock recall. Mock recall reconciliation of a released batch.*

![Figure 51](../SCREENSHOTS/super_admin/traceability_backward.png)

*Figure 51 — Backward genealogy. Input material lots with supplier, GRN and QC release evidence.*


#### Run a mock recall for a batch

1. Open Traceability & recall (or Trace on a batch page).
2. Type a batch number, internal lot or supplier batch and select Trace; choose the batch in the results.
3. Read the reconciliation cards. “Quantities reconcile” means every unit is accounted for; “Reconciliation gap” shows the unaccounted quantity to investigate.
4. Review Current locations and Finished-goods movements.
5. Users with report.export can select Export recall reconciliation (CSV, audited).


#### Trace a supplier lot forward

1. Search the internal lot or supplier batch, or select Trace on a material lot page.
2. The forward trace lists every batch that reserved or consumed the lot and the finished-goods lots produced, with on-hand and dispatched quantities.


### QA release queue

The disposition queue: Batches awaiting QC / QA and Material lots awaiting disposition. Release requires approved, passing QC, no open OOS or deviations, and an electronic signature; the rules are enforced by the server.

![Figure 52](../SCREENSHOTS/super_admin/qa_release_queue.png)

*Figure 52 — QA release queue. Batches and material lots awaiting QC/QA disposition.*


#### Work the release queue

1. Open QA release.
2. Select a batch or lot to open it.
3. Follow the release procedure on the batch or lot page.


### QC samples and results

Sample request → collection → testing → submission → review → approval (e-signature). Samples are requested automatically by goods receipts (raw/packaging material) and batch completion (finished product). Each result is evaluated against a snapshot of the specification; results outside specification are flagged as OOS candidates and an OOS investigation opens automatically.

![Figure 53](../SCREENSHOTS/super_admin/sample_list.png)

*Figure 53 — QC samples. QC sample list by status and stage.*

![Figure 54](../SCREENSHOTS/super_admin/sample_detail.png)

*Figure 54 — QC sample detail. A QC sample awaiting collection, with specification tests.*


#### Record sample collection

1. Open the sample (QC samples → Open).
2. Select Record collection, enter Quantity withdrawn (optional) and Remarks in the “Record sample collection” dialog, and confirm.
3. Sampling moves a quarantined lot to UNDER TEST and deducts the sampled quantity.

![Figure 55](../SCREENSHOTS/qc_analyst/wf_sample_requested.png)

*Figure 55 — QC sample requested. A requested sample with the specification tests to perform. (screen captured while signed in as QC Analyst)*

![Figure 56](../SCREENSHOTS/qc_analyst/wf_sample_collect_dialog.png)

*Figure 56 — Record sample collection. Recording sample collection (quantity withdrawn is deducted from the lot). (screen captured while signed in as QC Analyst)*


#### Enter results

1. In Tests & results enter each value (numeric, text or pass/fail) and the Instrument where applicable.
2. Select Save results. Each value is evaluated immediately (within spec / OOS candidate).
3. When all mandatory tests have results select Submit for review. Missing mandatory results are refused.

![Figure 57](../SCREENSHOTS/qc_analyst/wf_sample_results_entry.png)

*Figure 57 — Enter QC results. Result entry: each value is evaluated against the specification snapshot. (screen captured while signed in as QC Analyst)*

![Figure 58](../SCREENSHOTS/qc_analyst/wf_fp_results_entry.png)

*Figure 58 — Finished-product results. Finished-product test results entered against the product specification. (screen captured while signed in as QC Analyst)*


#### Review results

1. Open a SUBMITTED sample.
2. Check results, calculations and raw data.
3. Select Accept review, or Return to analyst with a Comment. You cannot review your own results.

![Figure 59](../SCREENSHOTS/qc_manager/wf_sample_reviewed.png)

*Figure 59 — Sample reviewed. Reviewed sample ready for approval. (screen captured while signed in as QC Manager)*


#### Approve a sample

1. Open a REVIEWED sample.
2. Select Approve (e-sign); re-enter your password in the electronic-signature dialog.
3. The conclusion (PASS / FAIL) is recorded. Approval is blocked while an OOS investigation is open (“OOS investigation open — approval and release are blocked”).

![Figure 60](../SCREENSHOTS/qc_manager/wf_sample_approve_signature.png)

*Figure 60 — Approve with electronic signature. Approval requires password re-entry; the signature meaning is recorded. (screen captured while signed in as QC Manager)*

![Figure 61](../SCREENSHOTS/qc_manager/wf_sample_approved.png)

*Figure 61 — Sample approved. Approved sample with PASS conclusion. (screen captured while signed in as QC Manager)*


#### Replace a result

1. Enter the new value and the Correction reason (required to replace the existing result).
2. The original value is kept; a flagged OOS result cannot be replaced while its investigation is open.


### OOS investigations

Out-of-specification results are reported automatically when a QC result falls outside its specification. The investigation follows fixed phases: Reported → Preliminary investigation → Laboratory investigation (Phase I) → Manufacturing investigation (Phase II) → Root cause → Impact assessment → CAPA → QA approval → Closed. Phases cannot be skipped. The conclusion — CONFIRMED OOS or INVALIDATED (lab error) — is a QA decision with electronic signature; invalidation requires an assignable laboratory error.

![Figure 62](../SCREENSHOTS/super_admin/oos_list.png)

*Figure 62 — OOS investigations. Out-of-specification investigations with phase and owner.*

![Figure 63](../SCREENSHOTS/super_admin/oos_detail.png)

*Figure 63 — OOS investigation detail. OOS investigation with phase stepper, linked records and QA conclusion area.*


#### Record an investigation phase

1. Open the OOS investigation.
2. Enter the findings for the current phase in the text field (in Phase I also answer “Was an assignable laboratory error identified?”).
3. Select Complete phase. The stepper moves to the next phase.
4. Link an existing deviation (Link) or select Raise deviation; at the CAPA phase select Create CAPA, or enter a Justification if no CAPA is required.

![Figure 64](../SCREENSHOTS/qa_officer/wf_oos_phase.png)

*Figure 64 — OOS investigation phase. Recording the current OOS investigation phase. (screen captured while signed in as QA Officer)*


#### Conclude the investigation (QA)

1. At QA approval, review all phases and linked records.
2. Select Conclude: confirmed OOS, or Conclude: invalidated (lab error) — the latter is only enabled when the laboratory investigation identified an assignable error. Sign with your password and reason.
3. The investigation owner cannot conclude their own investigation.


### Deviations

Draft → Submitted → QA review → Investigation → Root cause → CAPA → Effectiveness check → QA closure. Aging: 0–15 days normal, 16–30 attention, more than 30 overdue (configurable). Root-cause analysis uses structured 5-Whys and a fishbone (6M) category; each save is versioned and QA approves the final root cause.

![Figure 65](../SCREENSHOTS/super_admin/deviation_list.png)

*Figure 65 — Deviations. Deviation register with classification, aging and owner.*

![Figure 66](../SCREENSHOTS/super_admin/deviation_detail.png)

*Figure 66 — Deviation detail. Deviation record with workflow actions, RCA, CAPAs and evidence.*


#### Raise a deviation

1. Open Deviations → New (or Raise deviation on a batch, OOS or lot).
2. Under What happened enter Title, Description, Immediate action taken, Occurred at and optionally a Proposed severity.
3. Under Where & what is affected choose Site, Process stage and any Batch, Product, Material or Equipment.
4. Save as draft (then Submit to QA from the deviation page) or submit directly. Record what happened as soon as possible — QA classifies severity during review.

![Figure 67](../SCREENSHOTS/qa_officer/wf_deviation_create_form.png)

*Figure 67 — Raise a deviation. Deviation form: what happened, immediate action and affected records. (screen captured while signed in as QA Officer)*

![Figure 68](../SCREENSHOTS/qa_officer/wf_deviation_submitted.png)

*Figure 68 — Deviation submitted. Submitted deviation awaiting QA review. (screen captured while signed in as QA Officer)*


#### QA review and classification

1. Open a SUBMITTED deviation and select Start QA review.
2. Select Classify & assign: choose Classification (minor / major / critical), Investigation owner, Due date and QA review notes.
3. The deviation moves to INVESTIGATION.

![Figure 69](../SCREENSHOTS/qa_manager/wf_deviation_classify_dialog.png)

*Figure 69 — Classify and assign a deviation. QA classifies severity and assigns the investigation owner. (screen captured while signed in as QA Manager)*

![Figure 70](../SCREENSHOTS/qa_manager/wf_deviation_investigation.png)

*Figure 70 — Deviation in investigation. Classified deviation in INVESTIGATION with owner and due date. (screen captured while signed in as QA Manager)*


#### Investigate and record the root cause

1. Select Record investigation: enter Investigation summary and Impact assessment, then Save & move to root cause.
2. In Root cause analysis add 5-Whys (“Because…”), choose the Primary category and write the Root cause statement.
3. QA selects Approve root cause.


#### CAPA decision and closure

1. Select Record CAPA decision: answer “Is a CAPA required?” — create a CAPA (Create CAPA), or give a Justification.
2. After CAPA effectiveness is confirmed, select Close (e-sign) with the Effectiveness summary and your signature.
3. Cancel (reason required) is available for draft, submitted or in-review records raised in error.


#### Use the AI investigation assistant

1. On the deviation page open AI investigation assistant.
2. Review similar historical cases (computed by Pharmodry) and any suggested areas to investigate.
3. Nothing is written to the record; copy only what you agree with into your own investigation.


### CAPA

Corrective and preventive actions from deviations, OOS, OOT, audits, complaints, supplier issues and recalls. Each CAPA has actions with owners and due dates, effectiveness criteria and an effectiveness check. Closure requires a successful effectiveness check and a QA electronic signature; a failed check returns the CAPA to In Progress and is counted in the effectiveness-failure KPI.

![Figure 71](../SCREENSHOTS/super_admin/capa_list.png)

*Figure 71 — CAPA. CAPA register with priority, owner and due date.*

![Figure 72](../SCREENSHOTS/super_admin/capa_detail.png)

*Figure 72 — CAPA detail. CAPA with actions, effectiveness check and closure.*


#### Create a CAPA

1. Open CAPA → New (or Create CAPA from a deviation or OOS).
2. Enter Source, Priority, Owner, Due date, Problem statement, Root cause and Effectiveness criteria.
3. Add actions (corrective / preventive) with description, owner and due date.
4. Optional: AI CAPA assistant → Draft suggestions; select only the suggestions you agree with and edit them before saving (they are marked “AI-drafted, human-accepted”).
5. Select Create CAPA.

![Figure 73](../SCREENSHOTS/qa_manager/wf_capa_create_form.png)

*Figure 73 — Create a CAPA. CAPA form with problem statement, actions and the optional AI drafting assistant. (screen captured while signed in as QA Manager)*


#### Complete actions

1. Open the CAPA, select Mark complete on an action and record Objective evidence in the “Complete action” dialog.
2. Add action adds further actions while the CAPA is open or in progress.


#### Effectiveness check

1. When actions are complete, a user with capa.manage selects Submit for effectiveness check.
2. Select Record effectiveness check, answer “Was the CAPA effective?” and record Result / evidence.


#### Close a CAPA

1. After a successful effectiveness check select Close (e-sign) and sign. Cancel CAPA requires a reason.


### Product Quality Review (PQR) data pack

Figures computed for the PIC/S GMP Chapter 1 product quality review: batches manufactured with yield statistics, finished-product QC results (approved samples), deviations, OOS investigations, CAPAs and starting materials with suppliers. QA authors the evaluation and conclusions. Sections not captured in this release (for example stability, complaints, returns, change control) are listed so they can be added from source systems.

![Figure 74](../SCREENSHOTS/super_admin/pqr.png)

*Figure 74 — Product Quality Review. Product Quality Review data pack for a product and period.*


#### Prepare a PQR data pack

1. Open Product quality review.
2. Choose Product, From and To dates.
3. Review sections 1–6 and the “Sections not captured in this release” notice.
4. Select Print / PDF to save the pack.


### Master data: products, materials, suppliers, equipment and specifications

Regulated master data is versioned: every change requires a reason and creates a new immutable version (Version history). Products carry registration, shelf life, storage, GTIN (GS1, check digit verified), BOM and manufacturing template; materials carry type, retest period, safety stock and lead time; suppliers carry qualification status, approved materials and certifications; equipment carries calibration frequency and history; specifications hold versioned acceptance criteria.

![Figure 75](../SCREENSHOTS/super_admin/products.png)

*Figure 75 — Products. Product master list with GTIN and registration.*

![Figure 76](../SCREENSHOTS/super_admin/product_detail.png)

*Figure 76 — Product detail. Product detail: BOM, manufacturing template, specifications and versions.*

![Figure 77](../SCREENSHOTS/super_admin/materials.png)

*Figure 77 — Materials. Material master with released and quarantined stock.*

![Figure 78](../SCREENSHOTS/super_admin/material_detail.png)

*Figure 78 — Material detail. Material detail: lots in FEFO order, approved suppliers, specifications.*

![Figure 79](../SCREENSHOTS/super_admin/suppliers.png)

*Figure 79 — Suppliers. Supplier list with qualification status and scorecards.*

![Figure 80](../SCREENSHOTS/super_admin/supplier_detail.png)

*Figure 80 — Supplier detail. Supplier qualification, approved materials, certifications and receipts.*

![Figure 81](../SCREENSHOTS/super_admin/equipment.png)

*Figure 81 — Equipment & calibration. Equipment list with calibration status.*

![Figure 82](../SCREENSHOTS/super_admin/equipment_detail.png)

*Figure 82 — Equipment detail. Equipment detail with calibration history.*

![Figure 83](../SCREENSHOTS/super_admin/specifications.png)

*Figure 83 — QC specifications. Versioned QC specifications.*

![Figure 84](../SCREENSHOTS/super_admin/specification_detail.png)

*Figure 84 — Specification detail. Specification tests and acceptance criteria.*


#### Create or edit a product

1. Products → New product: Code, Generic name, Brand name, Strength, Dosage form, Category, Pack size, Shelf life (months), Registration number, GTIN, Batch number prefix, Unit of measure, Standard batch size, Unit price (PKR), Storage conditions.
2. Add the BOM and manufacturing template on the product page.
3. To change a product select Edit, update fields, enter Reason for change and Save new version.


#### Create or edit a material

1. Materials → New material: Code, Name, Type, Unit of measure, Internal lot prefix, Retest period, Safety stock, Supplier lead time, Unit cost, Specification reference, Storage requirement.
2. Approve suppliers for the material and create its QC specification before receiving it.


#### Create a supplier

1. Suppliers → New supplier: Code, Country, Name, Contact name, Email, Phone, Address.
2. New suppliers start as PENDING QUALIFICATION and cannot deliver GMP material until approved by QA.


#### Change supplier qualification / approve a material

1. On the supplier page select Change status: New status, Requalification date and Reason / basis (audit, questionnaire, sample evaluation…).
2. Approve material for this supplier: Material, Manufacturer (if different), Reason / basis.


#### Record equipment calibration

1. Equipment → open the item → Record calibration: Performed on, Result, Certificate number, Next due (optional override).
2. Next due defaults to performed date + calibration frequency. Equipment with expired calibration is blocked from eBMR steps (configurable BLOCK / WARN).


### Audit trail

Centralised, append-only record of who did what, when, with previous and new values, reasons and e-signatures. Entries cannot be edited or deleted from the application, and the database rejects any attempt to modify them. Each record page also has its own Audit trail tab.

![Figure 85](../SCREENSHOTS/super_admin/audit_trail.png)

*Figure 85 — Audit trail. Central audit trail with hash-chain verification.*


#### Review the audit trail

1. Open Audit trail; filter by Action, Record type, user or date.
2. Expand an entry to see previous and new values and the reason.
3. Select Verify integrity to recompute the hash chain: “Hash chain verified” confirms integrity; “Integrity failure” must be escalated immediately.


#### Export the audit trail

1. Apply filters and select Export. The export itself is audited.


### Reports and exports

CSV exports open in Excel (UTF-8, formula-injection safe): Batch summary, Inventory status, Near-expiry inventory, Expired stock, Audit trail; links to the Deviation, CAPA, OOS, QC and Supplier performance registers (use Export on each list); and the print-ready Batch manufacturing record. Exports are recorded in the audit trail.

![Figure 86](../SCREENSHOTS/super_admin/reports.png)

*Figure 86 — Reports. Report and export catalogue.*


### Administration: users, roles, organisation and AI governance

Accounts are created by administrators (no self-registration). Roles are sets of permission codes and can be scoped to a site; authorisation is always checked on the server. Organisation settings hold sites, warehouses & bins, departments, policies & thresholds (yield tolerance, consumption variance, deviation aging, QA release SLA, expired-calibration policy, default CAPA due days, batch number pattern, AI settings) and compliance scans. Every change requires a reason and is audited.

> **Note:** The receipt default status is fixed to QUARANTINE and cannot be changed through settings.

![Figure 87](../SCREENSHOTS/super_admin/admin_users.png)

*Figure 87 — Users. User administration with roles and site scope.*

![Figure 88](../SCREENSHOTS/super_admin/admin_roles.png)

*Figure 88 — Roles & permissions. Role and permission matrix (changes require a reason).*

![Figure 89](../SCREENSHOTS/super_admin/admin_organization.png)

*Figure 89 — Organisation & policies. Organisation, sites, warehouses and configurable policies.*

![Figure 90](../SCREENSHOTS/super_admin/admin_ai.png)

*Figure 90 — AI governance. AI usage, provider status and feedback.*


#### Create a user

1. Users → New user: Full name, Email, Job title, Department, Initial password.
2. Add Roles, each optionally with a Site scope.
3. Select Create user. Ask the user to change the password at first login (Profile → Change password).

![Figure 91](../SCREENSHOTS/company_admin/wf_user_create_dialog.png)

*Figure 91 — Create a user. New user: identity, initial password and role assignment with optional site scope. (screen captured while signed in as Company Admin)*


#### Change roles, deactivate, unlock or reset a password

1. Edit roles → Save roles (reason required).
2. Change status to deactivate (all sessions are revoked immediately; accounts are never deleted).
3. Unlock a Locked account, or Reset password with a New temporary password (all sessions revoked).


#### Configure roles and permissions

1. Roles & permissions → New role → Create role, then tick permissions.
2. Enter Reason for change (required) and save; Discard reverts unsaved changes.


#### Maintain organisation and policies

1. Organisation → Sites / plants, Warehouses & bins, Departments: Create entries.
2. Policies & thresholds: change values, enter Reason for change and save.
3. Compliance scans: run the expiry, low-stock, overdue, calibration and QA-backlog scans on demand.


## 7. Field-by-field explanations, required inputs and validation rules

General rules: required fields are marked; dates use the date picker; numbers must be positive unless stated; reasons must be at least 5 characters; unknown or malformed inputs are rejected by the server. Forms that you cannot submit are still shown for reference where you can view the module.


### Purchase orders

| Field | Required | Rules and meaning |
|---|---|---|
| Site | Yes | Receiving plant. |
| Supplier | Yes | Must be APPROVED or CONDITIONALLY APPROVED. |
| Expected delivery | No | Date. |
| Notes | No | Free text. |
| Material (line) | Yes | Only materials on the supplier’s approved list. |
| Quantity (line) | Yes | Positive number in the material’s unit. |
| Unit price (PKR) (line) | No | Used for order value and inventory valuation. |


### Goods receipts (GRN)

| Field | Required | Rules and meaning |
|---|---|---|
| Site | Yes | Your role may be limited to specific sites. |
| Supplier | Yes | Must be qualified; a “Supplier not qualified” warning blocks the receipt. |
| Purchase order | No | Load lines copies materials and open quantities. |
| Delivery note / DN number | Recommended | Supplier document reference. |
| Material | Yes | Must be approved for the supplier. |
| Supplier batch | Yes | Exactly as on the label / CoA. |
| Quantity | Yes | Positive, in the material’s unit of measure. |
| Containers | No | Number of containers. |
| Mfg date / Expiry date | Yes | Expiry must be after manufacturing date and in the future. |
| Retest date | No | Lots past retest date cannot be used. |
| Warehouse / Bin | Yes | Storage location. |


### Inventory, lots and stock movements

| Field | Required | Rules and meaning |
|---|---|---|
| Destination warehouse / Bin (transfer) | Yes | Target location. |
| Quantity (transfer) | Yes | Cannot exceed available (unreserved) quantity. |
| Quantity change (signed) (adjustment) | Yes | Negative reduces stock; the result can never be negative. |
| Reason | Yes | Recorded in the audit trail (minimum 5 characters). |


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
| Purchase orders | New purchase order | Opens the order form. | Yes |
| Purchase orders | Add line / Remove line | Adds or removes order lines. | Yes |
| Purchase orders | Create purchase order | Saves the order as DRAFT. | Yes |
| Purchase orders | Approve | Approves a draft (not your own). | Yes |
| Purchase orders | Cancel order | Cancels with a reason. | Yes |
| Goods receipts (GRN) | New | Opens the receipt form. | Yes |
| Goods receipts (GRN) | Load lines | Copies lines from the selected PO. | Yes |
| Goods receipts (GRN) | Add line / Remove line | Manages receipt lines. | Yes |
| Goods receipts (GRN) | Create GRN | Posts the receipt; lots go to QUARANTINE. | Yes |
| Inventory, lots and stock movements | QA release / Reject | QA disposition with electronic signature. | Yes |
| Inventory, lots and stock movements | Transfer | Moves stock between locations. | Yes |
| Inventory, lots and stock movements | Adjust | Posts a signed quantity change with reason. | Yes |
| Inventory, lots and stock movements | Block / Unblock | Temporarily prevents use of a released lot. | Yes |
| Inventory, lots and stock movements | Trace | Opens forward traceability for a material lot. | Yes |
| Batches and electronic batch records (eBMR) | Reserve materials | FEFO reservation of released lots. | Yes |
| Batches and electronic batch records (eBMR) | Release reservation | Returns reservations (reason required). | Yes |
| Batches and electronic batch records (eBMR) | Issue materials | Dispenses reserved lots to production. | Yes |
| Batches and electronic batch records (eBMR) | Start batch | Moves READY → IN PROGRESS. | Yes |
| Batches and electronic batch records (eBMR) | Start / Record & sign | Executes and signs eBMR steps. | Yes |
| Batches and electronic batch records (eBMR) | Verify | Second-person verification with signature. | Yes |
| Batches and electronic batch records (eBMR) | Correct | Corrects a recorded value with reason. | Yes |
| Batches and electronic batch records (eBMR) | Complete manufacturing | Calculates yield, books FG into quarantine. | Yes |
| Batches and electronic batch records (eBMR) | QA release / Reject | Final disposition with electronic signature. | Yes |
| Batches and electronic batch records (eBMR) | Close batch | Closes a released or rejected batch. | Yes |
| Batches and electronic batch records (eBMR) | Cancel | Cancels a batch before it starts (reason required). | Yes |
| Batches and electronic batch records (eBMR) | Trace | Opens traceability & mock recall for the batch (needs inventory.view too). | Yes |
| Batches and electronic batch records (eBMR) | Batch record | Printable executed batch record. | Yes |
| Traceability and mock recall | Trace | Searches batches and material lots (needs batch.view and inventory.view). | Yes |
| Traceability and mock recall | Export recall reconciliation | CSV export, recorded in the audit trail. | Yes |
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
| Raise purchase order | procurement.po.create | You perform this |
| Approve purchase order (different person) | procurement.po.approve | You perform this |
| Receive goods (GRN) → lots in QUARANTINE, QC sample requested | inventory.receive | You perform this |
| Collect sample and enter results | qc.result.enter | You perform this |
| Review results (different person) | qc.result.review | You perform this |
| Approve QC sample (e-signature) | qc.result.approve | You perform this |
| QA disposition of material lot (e-signature) | inventory.release | You perform this |
| Create / approve production plan | production.plan.manage | You perform this |
| Create batch | batch.create | You perform this |
| Reserve materials (FEFO, released lots only) | batch.reserve | You perform this |
| Issue materials to production | inventory.issue | You perform this |
| Start batch | batch.start | You perform this |
| Execute and sign eBMR steps | batch.execute | You perform this |
| Verify eBMR steps (different person, e-signature) | batch.verify | You perform this |
| Complete manufacturing (yield, FG to QUARANTINE) | batch.complete | You perform this |
| Finished-product QC (enter / review / approve) | qc.result.enter | You perform this |
| QA batch release or rejection (e-signature) | batch.approve | You perform this |
| Raise deviation | deviation.create | You perform this |
| Investigate deviation / OOS | deviation.investigate | You perform this |
| Classify, approve and close deviations | deviation.approve | You perform this |
| Conclude OOS (e-signature) | oos.approve | You perform this |
| Create and manage CAPA | capa.create | You perform this |
| Close CAPA (e-signature) | capa.close | You perform this |


### Electronic signatures

- Critical actions (approvals, releases, rejections, verifications, closures) open an Electronic signature dialog.
- Read the meaning of the signature shown in the dialog, enter a reason where requested and re-enter your password.
- “Your signature is legally binding within your company’s validated procedures.” A wrong password changes nothing and the failed attempt is recorded.
- The signature (your name, meaning, reason, time) is stored with the record and in the audit trail.


## 10. Status meanings

| Status | Meaning |
|---|---|
| DRAFT | Draft, not yet submitted/approved. |
| APPROVED | Approved (sample, supplier, PO or plan). |
| PARTIALLY RECEIVED | Part of the PO quantity received. |
| RECEIVED | Fully received (PO) / receipt posted (GRN). |
| CLOSED | Completed and closed. |
| CANCELLED | Cancelled with a reason; kept on record. |
| COMPLETED | eBMR step completed and signed by the operator (or CAPA action completed). |
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
| Batch summary (CSV) | Reports → Batch summary | Yes |
| Batch manufacturing record (print / PDF) | Batch page → Batch record | Yes (print) |
| Inventory status (CSV) | Reports or Inventory → Export CSV | Yes |
| Near-expiry inventory (CSV) | Reports or Inventory → Expiry intelligence | Yes |
| Expired stock (CSV) | Reports | Yes |
| Deviation register (CSV) | Deviations → Export CSV | Yes |
| CAPA register (CSV) | CAPA → Export CSV | Yes |
| OOS register (CSV) | OOS investigations → Export CSV | Yes |
| QC summary (CSV) | QC samples → Export CSV | Yes |
| Supplier performance (CSV) | Suppliers → Export CSV | Yes |
| Mock-recall reconciliation (CSV) | Traceability & recall → Export recall reconciliation | Yes |
| Product Quality Review data pack (print / PDF) | Product quality review → Print / PDF | Yes (print) |
| Audit trail (CSV) | Audit trail → Export | Yes |

Every export is recorded in the audit trail. CSV files are UTF-8 and protected against spreadsheet formula injection.


## 13. Notifications and alerts

- The bell shows unread notifications; Notifications → Inbox lists them and Mark all read clears the counter.
- Alerts come from workflows (for example QC sample requested, OOS reported, batch awaiting QA, assignment) and scheduled compliance scans (expiry, low stock, overdue CAPAs/deviations, calibration due, QA backlog).
- My preferences lets you choose which notifications you receive. In-app delivery is on by default; e-mail delivery requires SMTP configuration by an administrator and is not active in this release.

![Figure 92](../SCREENSHOTS/super_admin/notifications.png)

*Figure 92 — Notifications. Notification inbox and preferences.*


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
| Order rejected by business rules | Supplier not qualified, material not approved for the supplier, or invalid quantities. | Read the listed reasons; ask QA to qualify the supplier/material if needed. |
| Segregation of duties: the creator of a purchase order cannot approve it | You created the order. | Ask another user with approval rights. |
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
| admin.role.manage | Configure roles and permissions |
| admin.site.manage | Manage sites, departments, warehouses and bins |
| admin.tenant.manage | Manage company settings and policies |
| admin.user.manage | Create, deactivate and assign roles to users |
| ai.admin | View AI usage logs and configure AI governance |
| ai.assist.use | Use AI investigation and CAPA assistants |
| ai.copilot.use | Use the management copilot |
| analytics.view | View dashboards and analytics |
| audit.export | Export audit trail |
| audit.view | View audit trail |
| batch.approve | QA release or reject batches |
| batch.complete | Complete batches and record yield |
| batch.create | Create batches |
| batch.execute | Execute eBMR steps as operator |
| batch.reserve | Reserve and dispense materials for batches |
| batch.start | Start batches |
| batch.verify | Verify eBMR steps as supervisor |
| batch.view | View batches and eBMR |
| capa.close | QA closure of CAPAs |
| capa.create | Create CAPAs |
| capa.manage | Update CAPA actions and evidence |
| capa.verify | Record CAPA effectiveness checks |
| capa.view | View CAPAs |
| commandcenter.view | View Pharma Command Center |
| deviation.approve | QA review, classification and closure of deviations |
| deviation.create | Raise deviations |
| deviation.investigate | Investigate deviations and record root cause |
| deviation.view | View deviations |
| equipment.manage | Manage equipment and calibration records |
| inventory.adjust | Post stock adjustments |
| inventory.issue | Issue materials to production |
| inventory.receive | Receive goods (GRN) |
| inventory.release | QA disposition of material lots (release / reject) |
| inventory.transfer | Transfer stock between locations |
| inventory.view | View inventory lots and movements |
| masterdata.view | View master data |
| material.manage | Create and change materials |
| oos.approve | QA approval / closure of OOS investigations |
| oos.create | Report OOS investigations |
| oos.investigate | Record OOS investigation phases |
| oos.view | View OOS investigations |
| procurement.po.approve | Approve purchase orders |
| procurement.po.create | Create purchase orders |
| procurement.po.view | View purchase orders |
| product.manage | Create and change products, BOMs and routings |
| production.plan.approve | Approve production plans |
| production.plan.manage | Create and change production plans |
| production.plan.view | View production plans |
| qc.result.approve | Approve QC samples |
| qc.result.enter | Enter analytical results |
| qc.result.review | Review analytical results |
| qc.sample.collect | Record sample collection |
| qc.sample.create | Request QC samples |
| qc.view | View QC samples and results |
| report.export | Export reports |
| spec.manage | Manage QC specifications and test methods |
| supplier.approve | Change supplier qualification status |
| supplier.manage | Create and change suppliers |
| supplier.view | View suppliers |

Not granted (0 permissions): .

- Your role may additionally be limited to specific sites; records of other sites are then hidden or read-only.
- Never share your password: it is also your electronic-signature credential.
- Sign out or lock your screen when leaving the workstation.


## 17. Practical end-to-end example

Based on the fictional NovaCure demonstration data:

1. A new QC analyst joins: Users → New user, enter identity and an initial password, add role QC Analyst scoped to the Karachi site, Create user.
2. The analyst signs in and changes the password under Profile.
3. Later you review Audit trail filtered on User records to confirm the creation and role assignment were recorded with your identity.


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

- Integrity failure on audit verification, suspected account compromise or data corruption: stop affected work, inform the QA Manager and company management immediately, and follow the company incident SOP.
- Defects in the application: record the time, page, record number and correlation id from the error message, and report through your company’s change/incident process.

- Access problems (locked account, missing permission): Company Admin.
- Any suspected data-integrity problem (for example “Integrity failure” on audit verification): QA Manager immediately.
