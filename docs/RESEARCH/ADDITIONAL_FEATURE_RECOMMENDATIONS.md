# Additional Feature Recommendations

Derived from `PHARMA_INDUSTRY_PAIN_POINTS.md`, `REGULATORY_CONSIDERATIONS.md` and `COMPETITIVE_LANDSCAPE.md` (research 2026-10-17/18). Types: REG = regulatory requirement, GUIDE = guidance, BP = best practice, COMP = competitor capability, REC = our recommendation.

## Implemented in this release

### F1 — Batch genealogy & mock recall (P2, implemented)
1. **Pain point:** Recalls require immediate identification of where a material lot or batch went and what it contained.
2. **Users:** QA Manager, Regulatory Affairs, Plant Manager, Warehouse Manager.
3. **Value:** Minutes instead of days for trace; supports mock-recall exercises.
4. **Evidence:** Original Pharmodry requirement §26; GMP recall expectations (GUIDE); PQR includes recalls (PIC/S Ch.1).
5. **Effort:** Low (data already lot-level). 6. **Risks:** Dispatch-to-customer data not captured in MVP (ERP/distribution integration) — report states this.
7. **Scope:** MVP P2. 8. **Acceptance:** From a material lot, list batches that consumed it and their finished-goods lots/quantities; from a batch, list every input lot and supplier; CSV export; access requires `batch.view` + `inventory.view`.

### F2 — GS1 / serialization data readiness (P2, implemented)
1. **Pain point:** DRAP S.R.O. 963(I)/2026 requires 2D DataMatrix + serial numbers for products made from 9 Oct 2026 (REG).
2. **Users:** Regulatory Affairs, Production, QA. 3. **Value:** Single source for GTIN, batch, expiry used on labels; readiness tracking per product.
4. **Evidence:** APP 12 Oct 2026; DRAP notice 29 Aug 2025. 5. **Effort:** Low.
6. **Risks:** Not a serialization (L3/L4) system; serial number allocation and DRAP portal reporting depend on DRAP technical specs — explicitly out of scope.
7. **Scope:** MVP P2 (data only). 8. **Acceptance:** Product master holds an optional GTIN (14-digit, check-digit validated); batch record shows GS1 element string `(01)GTIN(17)YYMMDD(10)BATCH`; Command Center lists active products without GTIN as a compliance item.

### F3 — Product Quality Review data pack (P2, implemented)
1. **Pain point:** Annual PQR compilation is manual and slow (GUIDE: PIC/S Ch.1).
2. **Users:** QA Manager, Plant Manager, Auditor. 3. **Value:** Pre-compiled, traceable figures per product and period.
4. **Evidence:** PIC/S PE 009-17 Ch.1; Swissmedic TI on PQR contents. 5. **Effort:** Low–medium.
6. **Risks:** Stability, complaints, change control and returns are not yet captured — sections marked "not captured in this release".
7. **Scope:** MVP P2. 8. **Acceptance:** For a product and date range: batches (count, released, rejected), yield statistics, deviations by severity/category, OOS by conclusion, CAPAs and effectiveness, material suppliers used; printable.

## Recommended for later releases

| ID | Feature | Pain point / evidence | Type | Effort | Priority |
|---|---|---|---|---|---|
| R1 | Controlled document management + Site Master File + technical agreements, read-and-understood training | PIC/S Ch.4 enforced in Pakistan from Feb 2026; SMF/technical agreements from Jun 2026 | REG | High | P1 next release |
| R2 | Serial number allocation, aggregation and DRAP e-Services reporting (via a certified L3/L4 partner) | S.R.O. 963(I)/2026 | REG | High, partner-dependent | P1 next release |
| R3 | Change control with impact on products/documents/validation | ICH Q10, PIC/S | GUIDE | Medium | P2 |
| R4 | Complaints & pharmacovigilance intake with PV reportability triage | DRAP PV Rules 2022 | REG | Medium | P2 |
| R5 | OOT trending (statistical) on QC results and stability | FDA OOS guidance context, BP | BP | Medium | P2 |
| R6 | Stability study management | PQR inputs; LIMS competitors | BP/COMP | High | P3 (or LIMS integration) |
| R7 | Temperature excursion logging for stores/transport | WHO GDP | GUIDE | Medium | P3 |
| R8 | Review-by-exception batch record view | COMP (MasterControl, SAP BRH) | COMP | Medium | P2 |
| R9 | Document Copilot (RAG) over approved SOPs | Original requirement §36 | REC | Medium | P2 (after R1) |
| R10 | ERP adapters (SAP S/4HANA first) | Local SAP adoption | REC | High | P2 |
| R11 | Entra ID SSO, MFA | Security BP, Annex 11 draft | BP | Medium | P1 for production |

## Sources for the evidence cited above

All links were read during the 2026-10-17/18 research. Their reachability was re-checked on 2026-10-25. Links marked † did not respond from the build environment on 2026-10-25 (site unavailable, timeout or automated-client blocking), so their current content should be re-verified manually. Full context is in the three research documents.

| Item | Evidence | Source |
|---|---|---|
| F1 Batch genealogy / mock recall; F3 PQR | PIC/S GMP Guide Part I (Ch. 1 PQR, Ch. 8 recalls) | https://www.tga.gov.au/sites/default/files/manuf-pics-gmp-medicines-part1.pdf † |
| F2 GS1 / serialization readiness | DRAP serialization notice (2D barcode details by 1 Sep 2025) | https://www.dra.gov.pk/news_updates/regulatory_updates/general/submission-of-required-details-for-implementation-of-2-d-barcode-serialization-by-1st-september-2025 † |
| F2 | APP report on the digital verification / 2D DataMatrix timeline | https://www.app.com.pk/?p=1290194 |
| F2 | ProPakistani: digital verification system for all medicines | https://propakistani.pk/2026/06/02/pakistan-to-introduce-digital-verification-system-for-all-medicines/ |
| F3 PQR | Swissmedic technical interpretation on PQR contents | https://www.swissmedic.ch/dam/swissmedic/fr/dokumente/bewilligungen/inspektorat/i-smi_ti_14e_productqualityreviews.pdf.download.pdf/i-smi_ti_14e_productqualityreviews.pdf |
| R1 Document control / SMF | The News: DRAP starts implementing global GMP guidelines | https://www.thenews.pk/print/1401521-drap-starts-implementing-global-gmp-guidelines-for-pharma-industry |
| R4 Pharmacovigilance | DRAP pharmacovigilance overview (RegDesk) | https://www.regdesk.co/blog/drap-guidelines-on-national-pharmacovigilance-system-overview/ † |
| R5 OOT / OOS | FDA guidance, Investigating OOS test results | https://www.fda.gov/regulatory-information/search-fda-guidance-documents/investigating-out-specification-test-results-pharmaceutical-production |
| R8 Review by exception | BioPharm International, review by exception | https://www.biopharminternational.com/view/review-exception-connecting-dots-faster-batch-release |
| R10 ERP adapters | Martin Dow S/4HANA implementation in Pakistan | https://insidesap.asia/martin-dow-marker-first-pharma-company-pakistan-implement-s4hana/ |
| R11 SSO / MFA, Annex 11 | ECA: drafts of EU GMP Annex 11, Annex 22 and Chapter 4 | https://www.gmp-compliance.org/gmp-news/drafts-of-eu-gmp-guideline-annex-11-annex-22-and-chapter-4-released-for-comment |
| Risk-based prioritisation | ICH Q9(R1) presentation (FDA-hosted) | https://www.fda.gov/media/177720/download |
