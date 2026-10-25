# Demo Walkthrough (about 30 minutes)

This script follows the same paths as the automated browser tests (`apps/web/e2e/scenario-*.spec.ts`). Those tests run the flows end to end in Microsoft Edge and passed on 2026-10-18, so every step below is known to work on a freshly seeded database. Use a separate browser profile or private window per user if you want several people logged in at once.

## 0. Orientation (management@novacure.demo)

1. **Command Center** — exceptions needing attention: batches awaiting QA, open OOS, overdue CAPAs and deviations, expiring lots, low stock, calibration due, supplier certificates expiring, and *Serialization readiness* (OMZ-020 has no GTIN).
2. **Dashboard** — KPIs and charts: plan vs actual, batch yield trend against the tolerance band, deviation trend, CAPA aging, OOS trend, inventory value by status, near-expiry value, supplier QC rejection rate and batch release cycle time. Every chart has a table view.
3. **Copilot** — ask "Which CAPAs are overdue?". Without a Mistral key the answer is labelled *AI provider not configured* and shows the computed facts with links. With a key, the same facts are summarised in prose.

## 1. Scenario A — receipt to released batch

| Step | User | Where | What to show |
|---|---|---|---|
| 1 | warehouse.officer | Goods receipts → New | Receive MCC from *Lahore Excipients*. The lot is created in **QUARANTINE** and a QC sample (QCS-…) is requested automatically. |
| 2 | qa.officer | the new lot | "This lot cannot be released yet" — the blockers list the pending QC. The release button is disabled, and the API refuses too. |
| 3 | qc.analyst | the QC sample | Collect, enter results against the specification, submit. |
| 4 | qc.manager | same sample | Review and approve with an **electronic signature** (password re-entry). An analyst cannot approve their own results. |
| 5 | qa.officer | the lot | "Ready for QA disposition" → Release with e-signature → **RELEASED**. |
| 6 | planner | Batches → New | PCM-500. "All materials available" is checked against *released* stock only. Create the batch, then **Reserve** — FEFO picks the earliest-expiring released lots. |
| 7 | warehouse.officer | the batch | **Issue materials**. |
| 8 | production.supervisor | the batch | **Start**. |
| 9 | operator | Manufacturing (eBMR) tab | For each step: start, record the parameters and equipment, complete with e-signature. Out-of-range values are flagged. |
| 10 | production.supervisor | eBMR tab | **Verify** each step. The operator cannot verify their own step. |
| 11 | production.manager | the batch | **Complete** → calculated yield against tolerance. Finished goods go to QUARANTINE and a finished-product QC sample is created. |
| 12 | qc.analyst / qc.manager | QC tab → sample | Results → approve (PASS). |
| 13 | qa.manager | the batch | "Ready for QA release" → Release with e-signature. The finished-goods lot becomes RELEASED. **Audit trail** tab: signed events. **Record** button: printable batch record with the GS1 element string. |
| 14 | qa.manager | Traceability & recall | Search the batch: mock-recall reconciliation (produced vs on hand + dispatched ± adjustments) and backward genealogy to supplier lots, GRNs and QC releases. Export the CSV. |

## 2. Scenario B — dissolution failure (batch PCM-2026-000002)

| Step | User | What to show |
|---|---|---|
| 1 | qc.analyst | Enter dissolution **74 %** against spec **≥ 80 %**. Shown: "OOS candidate flagged". An OOS investigation opens automatically and approval is blocked. |
| 2 | qa.manager | On the batch: "QA release is blocked", with reasons linking to the failed QC and the open OOS. |
| 3 | qa.officer | OOS record: Phase I lab investigation (no assignable lab error) → Phase II. **Raise deviation** from the OOS. |
| 4 | qa.manager | Deviation: classify (e.g. MAJOR), assign, investigate. Try **AI assist** — similar historical cases are computed by Pharmodry; suggestions appear only when a key is configured. |
| 5 | qa.officer | Record root cause and impact on the OOS. **Create CAPA**: corrective and preventive actions with owners and due dates. |
| 6 | qa.manager | Conclude **Confirmed OOS** with e-signature. The investigation owner cannot conclude their own OOS. |
| 7 | qc.manager, then qa.manager | QC approval concludes FAIL. QA **rejects** the batch with a reason and e-signature. |
| 8 | qa.manager | **Audit trail** → "Hash chain verified". **Dashboard** → OOS trend updated. |

## 3. Controls worth demonstrating

- **Shortage (Scenario C):** open AMX-2026-000001 and try *Reserve* — it is blocked because released amoxicillin is insufficient, even though quarantined stock exists.
- **Tenant isolation:** log in as `admin@zenith.demo` — no NovaCure data is visible.
- **Read-only auditor:** `auditor@novacure.demo` can see records and the audit trail but has no action buttons. The API returns 403 if called directly.
- **PQR:** Quality → Product quality review → PCM-500, last 12 months → print to PDF.
- **Master data versioning:** edit a product (reason required). The version history section on the product page shows every version. Try an invalid GTIN — it is rejected by check-digit validation.

## Resetting between demos

See *Resetting the demo* in `DEMO_DATA_GUIDE.md`. The automated scenarios always run against their own fresh database, so they never disturb the demo database.
