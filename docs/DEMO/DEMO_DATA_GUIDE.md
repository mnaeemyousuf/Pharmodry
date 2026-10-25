# Demo Data Guide

All names, companies, people, registration numbers, GTINs and records are **fictional**. Supplier names carry "(demo)". Registration numbers carry "(demo)". GTINs use the GS1 restricted-circulation prefix `02`, so they can never be confused with real trade items.

## Logging in

- URL: http://localhost:3000. The login page lists the demo accounts when `NEXT_PUBLIC_DEMO_MODE=true`.
- Password for every demo account: the value of `SEED_DEMO_PASSWORD` when the database was seeded. The local development default is `Pharmodry!Demo26`. Use it only for this fictional local demo.
- Electronic signatures ask for the same password again.

## Tenants and sites

| Tenant | Sites | Purpose |
|---|---|---|
| NovaCure Pharmaceuticals Pvt Ltd (`NOVACURE`) | Karachi plant (KHI), Lahore distribution (LHR) | Main demo company |
| Zenith Laboratories (`ZENITH`) | Zenith Plant 1, Hyderabad | Second tenant, used to show data isolation. Login `admin@zenith.demo`. |

## Demo accounts (NovaCure)

| Email | Person (fictional) | Role |
|---|---|---|
| super.admin@novacure.demo | Imran Siddiqui | Super Admin |
| company.admin@novacure.demo | Ayesha Khan | Company Admin |
| plant.manager@novacure.demo | Tariq Mahmood | Plant Manager |
| production.manager@novacure.demo | Bilal Hussain | Production Manager |
| production.supervisor@novacure.demo | Usman Farooq | Production Supervisor |
| operator@novacure.demo, operator2@novacure.demo | Kamran Ali, Zainab Raza | Production Operator |
| qa.manager@novacure.demo | Dr. Nadia Qureshi | QA Manager |
| qa.officer@novacure.demo | Hamza Sheikh | QA Officer |
| qc.manager@novacure.demo | Farah Javed | QC Manager |
| qc.analyst@novacure.demo, qc.analyst2@novacure.demo | Ali Raza, Sana Malik | QC Analyst |
| warehouse.manager@novacure.demo | Asif Iqbal | Warehouse Manager |
| warehouse.officer@novacure.demo | Faisal Nawaz | Warehouse Officer (Karachi site only) |
| procurement.manager@novacure.demo | Rabia Aslam | Procurement Manager |
| procurement.officer@novacure.demo | Junaid Akhtar | Procurement Officer |
| planner@novacure.demo | Mehwish Anwar | Supply Chain Planner |
| engineering@novacure.demo | Naveed Ashraf | Engineering / Maintenance |
| regulatory@novacure.demo | Hina Baig | Regulatory Affairs |
| auditor@novacure.demo | Omar Zafar | Auditor (read-only) |
| management@novacure.demo | Shahid Latif | Management Viewer |

What each role can do is listed in `docs/USER_MANUALS/ROLE_AND_PERMISSION_CATALOG.md`.

## Master data

| Products | Code | Brand | GTIN (demo) | Standard batch |
|---|---|---|---|---|
| Paracetamol 500 mg tablets, 10 × 10 Alu-PVC | PCM-500 | NovaPara 500 | 02000000010014 | 200,000 tablets |
| Amoxicillin 500 mg capsules, 2 × 10 | AMX-500 | NovaMox 500 | 02000000010021 | 100,000 capsules |
| Omeprazole 20 mg capsules, 2 × 7 Alu-Alu | OMZ-020 | NovaZole 20 | *none — intentionally missing, so the Command Center shows a serialization-readiness gap* | 100,000 capsules |

**Materials (11):**
- APIs: `API-PCM-001`, `API-AMX-001`, `API-OMZ-001` (cold chain)
- Excipients: `EXC-MCC-101`, `EXC-STA-001`, `EXC-PVP-K30`, `EXC-MGS-001`
- Packaging: `PKG-PVC-250`, `PKG-ALU-020`, `PKG-CAP-0`, `PKG-CAP-2`

**Suppliers (8):**

| Supplier | Status | Note |
|---|---|---|
| Meridian Pharmachem (China, PCM API) | Approved | Its ISO certificate expires in 20 days |
| Aurelia Lifesciences (India, AMX API) | Approved | |
| Lahore Excipients (Pakistan) | Approved | |
| Indus Packaging | Approved | Its ISO 15378 certificate **expired 12 days ago** |
| CapsuTech Asia (Malaysia) | Conditionally approved | |
| Gujarat Pelletech (India, OMZ pellets) | Approved | |
| Karachi Chemical Traders | Pending qualification | |
| Delta Fine Chemicals | Suspended | |

**Warehouses:**
- Karachi: Raw Material Store `WH-RM` (incl. `COLD-01`), Packaging Store `WH-PM`, Finished Goods `WH-FG`, Rejected Material Cage `WH-REJ`
- Lahore: Distribution Warehouse `WH-LHR-FG`

Specifications, test methods, BOMs, eBMR routings and equipment (with calibration due dates) are seeded for every product.

## History (six months)

`seed/history.ts` creates about six months of batches, QC samples, deviations, CAPAs and stock movements so dashboards and trends have data. These records are labelled **migrated legacy records**. Their signatures carry the meaning `MIGRATED_RECORD`, and no one in the demo "signed" them in Pharmodry.

## Today's live scenarios

These records are created through the real application services, so every rule, audit event and signature applies:

| | Scenario | Records (on a fresh seed) |
|---|---|---|
| A | Successful release — PCM API received, quarantined, QC approved, QA released, batch manufactured, QC passed, QA released | GRN-2026-00001, lot RM26-00001, batch **PCM-2026-000001** RELEASED |
| B | Failed QC — dissolution 74 % vs ≥ 80 % → OOS → deviation; release blocked | batch **PCM-2026-000002**, OOS-2026-0001, DEV-2026-0001 (MAJOR, in investigation) |
| C | Shortage — reservation blocked: "Insufficient released material" | batch **AMX-2026-000001** |
| D | Batch in progress (dispensing complete) | batch **OMZ-2026-000001** |
| E | Receipt awaiting QC | GRN-2026-00002 |

Scheduled scans then raise alerts. Typical counts: 1 expired lot, about 119 expiry alerts, 12 low-stock alerts, 3 overdue CAPAs, 6 overdue deviations, 9 calibration alerts.

## Resetting the demo

The seed refuses to run on a database that already contains NovaCure. To start fresh without destroying anything, create a new database, migrate and seed it, then point `apps/api/.env` at it (commands in `docs/DATABASE.md`). `npm run db:reset` wipes the target database. Use it only on a disposable local database.
