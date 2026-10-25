# Pharmodry — Procurement Manager User Manual

- Product: Pharmodry 0.1.0 (MVP release)
- Intended audience: Head of purchasing.
- Document version: 1.0
- Generated: 2026-10-25 (screenshots captured 2026-10-25)
- Role code: PROCUREMENT_MANAGER

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

Creates and approves purchase orders, maintains supplier records, views inventory and analytics, and uses the Copilot.

This manual covers every Pharmodry screen available to the Procurement Manager role in release 0.1.0. Your exact access is set by your company’s administrator; if your account has additional roles or a site restriction, you may see more or fewer options than described. Configuration-dependent behaviour (for example tolerances, aging thresholds, calibration policy, AI availability) is marked as such.

> **Not available in this release:** Pharmacovigilance, sales/distribution and accounting modules; customer-level distribution in recalls; e-mail notifications; serial-number management; MFA/single sign-on. These are not described as working anywhere in this manual.


## 2. Role responsibilities

- Approve purchase orders raised by others (never your own).
- Maintain supplier master data and certifications.
- Monitor supplier scorecards (on-time, QC rejection, lead time).


### Dependencies on other departments

- QA — supplier qualification.
- Planner — demand.
- Warehouse — receipts.


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

![Figure 2](../SCREENSHOTS/procurement_manager/profile.png)

*Figure 2 — Profile & security. Profile: password change and active sessions.*


## 4. Home page and dashboard overview

After sign-in you land on My work. It greets you by name and lists the work queues that match your permissions — for example batches awaiting QA release, material lots awaiting disposition, open QC samples, deviations or CAPAs you own, batches on the shop floor, planned batches to prepare and purchase orders awaiting receipt. Each queue links straight to the records. Queues you have no permission for are not shown.

![Figure 3](../SCREENSHOTS/procurement_manager/my_work.png)

*Figure 3 — My work (home). Home page with the work queues available to this role.*


### Management dashboard

KPI cards (Active batches, Awaiting QA release, Open deviations, Overdue CAPAs, Open OOS, Materials at high risk, Near-expiry inventory, Plan achievement, Avg batch release time, Supplier quality score) and charts: Production plan vs actual, Batch yield trend (shaded band = configured tolerance), Deviation trend, CAPA aging, OOS trend, Inventory value by status, Near-expiry inventory, Supplier QC rejection rate and Batch release cycle time. All figures are computed from live regulated records.

![Figure 4](../SCREENSHOTS/procurement_manager/dashboard.png)

*Figure 4 — Management dashboard. KPI cards and charts computed from live records; click a KPI to drill down.*


## 5. Navigation and module overview

- The left sidebar lists only the modules your role can open, grouped into Overview, Supply & inventory, Production, Quality, Master data and Governance.
- The top bar has global search (“Search batches, lots, deviations, CAPAs…”, shortcut Ctrl K), a “Demo data” badge in demonstration environments, the light/dark theme toggle, the notification bell and your user menu (name and job title).
- Record numbers are links; detail pages show a status badge, key facts, actions you may perform and tabs with history.

The sidebar below was recorded from the application while signed in as the demo Procurement Manager (procurement.manager@novacure.demo).

| Sidebar group | Menu entry | Address |
|---|---|---|
| Overview | My work | / |
| Overview | Dashboard | /dashboard |
| Overview | Copilot | /copilot |
| Supply & inventory | Purchase orders | /procurement/purchase-orders |
| Supply & inventory | Goods receipts | /inventory/receipts |
| Supply & inventory | Inventory | /inventory |
| Supply & inventory | Stock movements | /inventory/movements |
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

![Figure 5](../SCREENSHOTS/procurement_manager/copilot.png)

*Figure 5 — Copilot. Copilot question box. Answers are computed by Pharmodry; the AI only explains them.*


#### Ask the Copilot

1. Open Copilot from the sidebar.
2. Type your question in “Ask a question about your operation…” and select Send.
3. Read the answer and open the cited records to verify.
4. Rate the answer with Thumbs up / Thumbs down to help administrators monitor quality.


### Purchase orders

Purchase orders may only be raised with qualified suppliers (APPROVED or CONDITIONALLY APPROVED) for materials on that supplier’s approved list. A new order is a DRAFT until a different user approves it.

![Figure 6](../SCREENSHOTS/procurement_manager/po_list.png)

*Figure 6 — Purchase orders. Purchase order list with status, supplier and value.*

![Figure 7](../SCREENSHOTS/procurement_manager/po_detail.png)

*Figure 7 — Purchase order detail. Purchase order detail with lines, approval and audit trail.*


#### Create a purchase order

1. Open Purchase orders and select New purchase order.
2. Choose the Site and the Supplier (suspended or blacklisted suppliers are disabled in the list).
3. Optionally enter Expected delivery and Notes.
4. Select Add line; choose a Material (only materials approved for this supplier are listed), enter Quantity and Unit price (PKR).
5. Check the Total and select Create purchase order. The order is created as a draft.

![Figure 8](../SCREENSHOTS/procurement_officer/wf_po_create_form.png)

*Figure 8 — Create a purchase order. New purchase order: approved supplier, approved material, quantity and price. (screen captured while signed in as Procurement Officer)*

![Figure 9](../SCREENSHOTS/procurement_officer/wf_po_draft.png)

*Figure 9 — Purchase order in draft. The new order is a draft until a different user approves it. (screen captured while signed in as Procurement Officer)*


#### Approve a purchase order

1. Open the draft order.
2. Check supplier, lines, quantities and value.
3. Select Approve. You cannot approve an order you created yourself.

![Figure 10](../SCREENSHOTS/procurement_manager/wf_po_awaiting_approval.png)

*Figure 10 — Approve a purchase order. Draft order awaiting approval by the procurement manager.*

![Figure 11](../SCREENSHOTS/procurement_manager/wf_po_approved.png)

*Figure 11 — Approved purchase order. Approved order, ready for goods receipt.*


#### Cancel a purchase order

1. Open the order and select Cancel order.
2. Enter a reason and confirm. Cancelled orders stay on record.


### Goods receipts (GRN)

Every receipt line creates a separate lot with its own internal lot number in QUARANTINE and automatically requests a QC sample. Material only becomes usable after QC approval and QA release. Receipts are refused for expired material, for suppliers that are not qualified, for materials not approved for the supplier, and when the expiry date is before the manufacturing date.

![Figure 12](../SCREENSHOTS/procurement_manager/grn_list.png)

*Figure 12 — Goods receipts. Goods receipts (GRN). Every line creates a lot in QUARANTINE.*

![Figure 13](../SCREENSHOTS/procurement_manager/grn_detail.png)

*Figure 13 — Goods receipt detail. Received lots and their status after a goods receipt.*

> **Not available to your role:** Receive material — requires inventory.receive.


### Inventory, lots and stock movements

Inventory is held per lot and location with a status. Only RELEASED, unexpired lots that are not past retest can be reserved or consumed; quarantined, under-test, rejected, blocked or expired lots never can. Tabs: Lots, Stock by material, Stock-out risk and Expiry intelligence. Every quantity change is written to an append-only ledger (Stock movements).

![Figure 14](../SCREENSHOTS/procurement_manager/inventory_list.png)

*Figure 14 — Inventory. Lot-level inventory with status, location and expiry filters.*

![Figure 15](../SCREENSHOTS/procurement_manager/inventory_risk.png)

*Figure 15 — Stock-out risk. Stock-out risk by material (released stock vs planned demand and lead time).*

![Figure 16](../SCREENSHOTS/procurement_manager/inventory_expiry.png)

*Figure 16 — Expiry intelligence. Expiry intelligence buckets with recommended actions.*

![Figure 17](../SCREENSHOTS/procurement_manager/lot_quarantine.png)

*Figure 17 — Lot in quarantine. A quarantined lot: release is blocked until QC approval; blockers are listed.*

![Figure 18](../SCREENSHOTS/procurement_manager/lot_released.png)

*Figure 18 — Released lot. A released material lot with available quantity, location and expiry.*

![Figure 19](../SCREENSHOTS/procurement_manager/movements.png)

*Figure 19 — Stock movements. Append-only inventory ledger of every movement.*


#### Find a lot

1. Open Inventory.
2. Use the quick views (All on hand, Available (released), Awaiting disposition, Expiring ≤ 30 d / ≤ 60 d / ≤ 90 d, Expired) and the Status, Type and Warehouse filters.
3. Type part of a lot or item name in the table search.
4. Select a lot number to open the lot page (Overview, Movements, QC, Used in batches, Audit trail).

> **Not available to your role:** Release or reject a material lot (QA disposition) — requires inventory.release; Transfer stock — requires inventory.transfer; Post a stock adjustment — requires inventory.adjust; Block or unblock a released lot — requires inventory.release; Export inventory and expiry lists — requires report.export.


### Master data: products, materials, suppliers, equipment and specifications

Regulated master data is versioned: every change requires a reason and creates a new immutable version (Version history). Products carry registration, shelf life, storage, GTIN (GS1, check digit verified), BOM and manufacturing template; materials carry type, retest period, safety stock and lead time; suppliers carry qualification status, approved materials and certifications; equipment carries calibration frequency and history; specifications hold versioned acceptance criteria.

![Figure 20](../SCREENSHOTS/procurement_manager/products.png)

*Figure 20 — Products. Product master list with GTIN and registration.*

![Figure 21](../SCREENSHOTS/procurement_manager/product_detail.png)

*Figure 21 — Product detail. Product detail: BOM, manufacturing template, specifications and versions.*

![Figure 22](../SCREENSHOTS/procurement_manager/materials.png)

*Figure 22 — Materials. Material master with released and quarantined stock.*

![Figure 23](../SCREENSHOTS/procurement_manager/material_detail.png)

*Figure 23 — Material detail. Material detail: lots in FEFO order, approved suppliers, specifications.*

![Figure 24](../SCREENSHOTS/procurement_manager/suppliers.png)

*Figure 24 — Suppliers. Supplier list with qualification status and scorecards.*

![Figure 25](../SCREENSHOTS/procurement_manager/supplier_detail.png)

*Figure 25 — Supplier detail. Supplier qualification, approved materials, certifications and receipts.*

![Figure 26](../SCREENSHOTS/procurement_manager/equipment.png)

*Figure 26 — Equipment & calibration. Equipment list with calibration status.*

![Figure 27](../SCREENSHOTS/procurement_manager/equipment_detail.png)

*Figure 27 — Equipment detail. Equipment detail with calibration history.*

![Figure 28](../SCREENSHOTS/procurement_manager/specifications.png)

*Figure 28 — QC specifications. Versioned QC specifications.*

![Figure 29](../SCREENSHOTS/procurement_manager/specification_detail.png)

*Figure 29 — Specification detail. Specification tests and acceptance criteria.*


#### Create a supplier

1. Suppliers → New supplier: Code, Country, Name, Contact name, Email, Phone, Address.
2. New suppliers start as PENDING QUALIFICATION and cannot deliver GMP material until approved by QA.


#### Change supplier qualification / approve a material

1. On the supplier page select Change status: New status, Requalification date and Reason / basis (audit, questionnaire, sample evaluation…).
2. Approve material for this supplier: Material, Manufacturer (if different), Reason / basis.

> **Not available to your role:** Create or edit a product — requires product.manage; Create or edit a material — requires material.manage; Record equipment calibration — requires equipment.manage.


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


## 8. Buttons and their functions

| Module | Button | What it does | Available to you |
|---|---|---|---|
| Purchase orders | New purchase order | Opens the order form. | Yes |
| Purchase orders | Add line / Remove line | Adds or removes order lines. | Yes |
| Purchase orders | Create purchase order | Saves the order as DRAFT. | Yes |
| Purchase orders | Approve | Approves a draft (not your own). | Yes |
| Purchase orders | Cancel order | Cancels with a reason. | Yes |
| Goods receipts (GRN) | New | Opens the receipt form. | No (needs inventory.receive) |
| Goods receipts (GRN) | Load lines | Copies lines from the selected PO. | No (needs inventory.receive) |
| Goods receipts (GRN) | Add line / Remove line | Manages receipt lines. | No (needs inventory.receive) |
| Goods receipts (GRN) | Create GRN | Posts the receipt; lots go to QUARANTINE. | No (needs inventory.receive) |
| Inventory, lots and stock movements | QA release / Reject | QA disposition with electronic signature. | No (needs inventory.release) |
| Inventory, lots and stock movements | Transfer | Moves stock between locations. | No (needs inventory.transfer) |
| Inventory, lots and stock movements | Adjust | Posts a signed quantity change with reason. | No (needs inventory.adjust) |
| Inventory, lots and stock movements | Block / Unblock | Temporarily prevents use of a released lot. | No (needs inventory.release) |
| Inventory, lots and stock movements | Trace | Opens forward traceability for a material lot. | No (needs batch.view) |

Buttons you cannot use are hidden or disabled in the application; the server refuses the action even if attempted another way.


## 9. Workflow, approvals and electronic signatures

The table shows the main GMP workflow and where your role takes part. Segregation of duties is enforced by the server: the person who performs a step cannot review, verify or approve it.

| Workflow step | Permission | Your role |
|---|---|---|
| Raise purchase order | procurement.po.create | You perform this |
| Approve purchase order (different person) | procurement.po.approve | You perform this |
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
| Inventory status (CSV) | Reports or Inventory → Export CSV | View only — export needs report.export |
| Near-expiry inventory (CSV) | Reports or Inventory → Expiry intelligence | View only — export needs report.export |
| Expired stock (CSV) | Reports | View only — export needs report.export |
| Supplier performance (CSV) | Suppliers → Export CSV | View only — export needs report.export |
| Product Quality Review data pack (print / PDF) | Product quality review → Print / PDF | Yes (print) |

Every export is recorded in the audit trail. CSV files are UTF-8 and protected against spreadsheet formula injection.


## 13. Notifications and alerts

- The bell shows unread notifications; Notifications → Inbox lists them and Mark all read clears the counter.
- Alerts come from workflows (for example QC sample requested, OOS reported, batch awaiting QA, assignment) and scheduled compliance scans (expiry, low stock, overdue CAPAs/deviations, calibration due, QA backlog).
- My preferences lets you choose which notifications you receive. In-app delivery is on by default; e-mail delivery requires SMTP configuration by an administrator and is not active in this release.

![Figure 30](../SCREENSHOTS/procurement_manager/notifications.png)

*Figure 30 — Notifications. Notification inbox and preferences.*


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
| inventory.view | View inventory lots and movements |
| masterdata.view | View master data |
| procurement.po.approve | Approve purchase orders |
| procurement.po.create | Create purchase orders |
| procurement.po.view | View purchase orders |
| supplier.manage | Create and change suppliers |
| supplier.view | View suppliers |

Not granted (50 permissions): admin.tenant.manage, admin.site.manage, admin.user.manage, admin.role.manage, product.manage, material.manage, supplier.approve, equipment.manage, spec.manage, inventory.receive, inventory.transfer, inventory.adjust, inventory.issue, inventory.release, production.plan.view, production.plan.manage, production.plan.approve, batch.view, batch.create, batch.reserve, batch.start, batch.execute, batch.verify, batch.complete, batch.approve, qc.view, qc.sample.create, qc.sample.collect, qc.result.enter, qc.result.review, qc.result.approve, oos.view, oos.create, oos.investigate, oos.approve, deviation.view, deviation.create, deviation.investigate, deviation.approve, capa.view, capa.create, capa.manage, capa.verify, capa.close, audit.view, audit.export, commandcenter.view, report.export, ai.assist.use, ai.admin.


### Procedures you cannot perform

- Goods receipts (GRN): Receive material — requires inventory.receive
- Inventory, lots and stock movements: Release or reject a material lot (QA disposition) — requires inventory.release
- Inventory, lots and stock movements: Transfer stock — requires inventory.transfer
- Inventory, lots and stock movements: Post a stock adjustment — requires inventory.adjust
- Inventory, lots and stock movements: Block or unblock a released lot — requires inventory.release
- Inventory, lots and stock movements: Export inventory and expiry lists — requires report.export
- Master data: products, materials, suppliers, equipment and specifications: Create or edit a product — requires product.manage
- Master data: products, materials, suppliers, equipment and specifications: Create or edit a material — requires material.manage
- Master data: products, materials, suppliers, equipment and specifications: Record equipment calibration — requires equipment.manage

- Your role may additionally be limited to specific sites; records of other sites are then hidden or read-only.
- Never share your password: it is also your electronic-signature credential.
- Sign out or lock your screen when leaving the workstation.


## 17. Practical end-to-end example

Based on the fictional NovaCure demonstration data:

1. A procurement officer raises a PO for 500 kg MCC.
2. Open the draft PO, check supplier status and price, select Approve.
3. The PO is APPROVED and can be received.


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

- Supplier quality issues and qualification: QA Manager. Urgent shortages: Supply Chain Planner and Plant Manager.

- Access problems (locked account, missing permission): Company Admin.
- Any suspected data-integrity problem (for example “Integrity failure” on audit verification): QA Manager immediately.
