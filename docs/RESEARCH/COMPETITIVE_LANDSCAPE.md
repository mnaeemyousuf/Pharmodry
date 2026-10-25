# Competitive Landscape

Research performed 2026-10-17/18 by web search. Capabilities are as described in vendor material or third-party listings; vendor marketing claims (e.g. percentage improvements) are **not** independently verified and are flagged as such. Pricing was not researched.

## 1. Categories the customer already buys

| Category | Typical products | What they do well | Gap Pharmodry targets |
|---|---|---|---|
| ERP | SAP S/4HANA (incl. SAP Batch Release Hub for Life Sciences), Oracle, Business Central | Finance, MM/PP, batch master, FEFO, QM inspection lots. SAP markets a Batch Release Hub with a release-decision dashboard, automated checks and e-signatures (cloud, S/4HANA integrated). | ERP-centric UIs are heavy for QA/QC/shop-floor users; exception management across quality + inventory + production is weak without add-ons. Pharmodry is an **overlay** with an ERPAdapter, not a replacement. |
| eQMS | Veeva Vault QMS, Honeywell TrackWise Digital, MasterControl QMS | Mature deviation/CAPA/change/audit/complaint workflows, effectiveness checks, audit trails. Veeva Batch Release listed by Veeva as "early" maturity (1–10 customers) and dependent on Vault QMS + QualityDocs. TrackWise Digital markets QualityWise.ai for complaint categorisation/reportability suggestions. | High licence + implementation cost reported for smaller firms; QMS usually separate from inventory/eBMR, so release decisions require cross-system review. |
| MES / eBMR | MasterControl Manufacturing Excellence, Apprentice Tempo, Emerson DeltaV MES | Electronic batch records, review-by-exception, in-line checks, equipment logbooks/calibration links. | Implementation and validation effort; often not connected to supplier and inventory risk. |
| LIMS | LabWare, LabVantage | Sample lifecycle, chain of custody, stability, environmental monitoring, instrument integration. LabVantage markets a pre-validated pharma configuration. | OOS investigation-to-deviation/CAPA linkage was not evident in results; batch-release context lives elsewhere. |

## 2. Pakistan context

* SAP S/4HANA is used by several Pakistani manufacturers (e.g. Martin Dow, Genix Pharma — scope incl. QM/QA/QC and PP; Getz Pharma — SAP ERP, BI/BW, EWM), per SAP/partner material. No independent adoption survey was found; no Oracle pharma case in Pakistan surfaced.
* Many mid-size manufacturers still run paper BMRs and spreadsheets for QA/QC (industry knowledge; **not** quantified by an authoritative source in this research).

## 3. Positioning (our recommendation — REC)

Pharmodry differentiates on **exception-driven operations across silos** (Command Center), **lot-level traceability tied to QC/QA decisions**, a **regulator-aware default configuration for DRAP/PIC/S**, and **assistive AI that only explains computed facts**. It integrates with — rather than replaces — SAP/Oracle/LIMS.

| Capability | Veeva QMS | TrackWise Digital | MasterControl Mx | SAP BRH | **Pharmodry MVP** |
|---|---|---|---|---|---|
| Deviation / CAPA / effectiveness | ✔ mature | ✔ mature | (QMS product) | — | ✔ |
| OOS investigation linked to batch release | Lab investigation module | ✔ | — | Release checks | ✔ (blocks release) |
| eBMR execution | — | — | ✔ | — | ✔ basic |
| Lot-level inventory, FEFO, quarantine | — | — | — | ✔ (ERP) | ✔ |
| Release-decision cockpit | Batch Release (early) | — | Review by exception | ✔ | ✔ release blockers + Command Center |
| Stock-out / expiry risk analytics | — | — | — | partial | ✔ deterministic |
| AI assistance | Vault AI (not researched) | QualityWise.ai | — | — | ✔ Mistral, governed |
| DRAP-specific defaults (PKR, numbering, PIC/S phase) | — | — | — | — | ✔ |

## Sources (accessed 2026-10-17/18)

* Veeva — QMS product brief: https://www.veeva.com/resources/veeva-qms-product-brief/
* Veeva — Product sheet, Vault Quality: https://www.veeva.com/wp-content/uploads/2023/07/Veeva-Product-Sheet-Vault-Quality.pdf
* Veeva — Quality Vault help (effectiveness checks): https://quality.veevavault.help/en/lr/34814/
* rfp.wiki — Veeva QMS reviews: https://www.rfp.wiki/vendors/veeva-qms
* Sparta/Honeywell — TrackWise Digital Quality Suite: https://go.spartasystems.com/rs/084-QBA-512/images/TrackWise-Digital-Quality-Suite.pdf
* Sparta — TrackWise Digital complaint management datasheet: https://info.spartasystems.com/rs/hce/images/trackwise-digital-complaint-management_2.pdf?version=0
* SoftwareConnect — TrackWise review: https://softwareconnect.com/reviews/trackwise/
* IntuitionLabs — MasterControl Manufacturing Excellence: https://intuitionlabs.ai/software/manufacturing-quality-supply-chain/electronic-batch-records-ebr/mastercontrol-manufacturing-excellence
* MasterControl — Master batch records: https://www.mastercontrol.com/au/library/manufacturing/master-batch-records/
* SAP — Batch Release Hub for Life Sciences: https://www.sap.com/italy/products/scm/batch-release-hub.html
* PwC — SAP S/4HANA for life sciences supply chain: https://www.pwc.com/us/en/technology/alliances/library/sap-s4hana-pharma-life-sciences-supply-chain.html
* LabWare — QA/QC LIMS: https://www.labware.com/lims/saas/qaqc
* BioPharm International — LabVantage Pharma: https://www.biopharminternational.com/view/labvantage-pharma
* Phoneworld — SAP and Martin Dow: https://www.phoneworld.com.pk/sap-enables-pharma-innovation-in-pakistan-led-by-martin-dow/
* Inside SAP — Martin Dow Marker S/4HANA: https://insidesap.asia/martin-dow-marker-first-pharma-company-pakistan-implement-s4hana/
* ProPakistani — SuperNova Solutions RISE with SAP (Genix): https://propakistani.pk/2022/01/14/supernova-solutions-implements-first-rise-with-sap/amp/
* TMC client list (Getz, Ali Gohar, Hilton Pharma): https://www.clients.tmcltd.com/category/healthcare-and-pharma/
