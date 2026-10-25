# Regulatory Considerations

Research performed with live web search on **2026-10-17/18**. Where a statement could only be confirmed from secondary sources (news, consultancies), this is stated. Nothing here is legal advice; customers must confirm obligations with DRAP / their regulators and their own QA.

**Legend** — `REG` = binding law/regulation · `GUIDE` = regulator or international guidance · `BP` = industry best practice · `REC` = our product recommendation.

## 1. Pakistan (initial market)

| # | Topic | Type | What we found | Relevance to Pharmodry |
|---|---|---|---|---|
| P1 | **PIC/S GMP becomes the inspection reference standard** | REG | S.R.O. 1587(I)/2025 (25 Aug 2025) amends the Drugs (Licensing, Registering and Advertising) Rules 1976, replacing references to Schedules B/B-1/B-IA with PIC/S GMP guidelines. The CLB approved a phased roll-out: **Phase 1 (from 25 Feb 2026) — PIC/S GMP Chapter 4 (Documentation)**; **from 1 Jun 2026 — Site Master File and Technical Agreements**; other chapters later after a readiness review. Pakistan is not (yet) a full PIC/S member. | Documentation, records, audit trails and data integrity are now the first area inspected against PIC/S. Strongly supports Pharmodry's controlled-record, audit-trail and e-signature design and the Document Management module on the roadmap. |
| P2 | Legacy GMP schedules / DRAP compiled GMP guideline | REG/GUIDE | DRAP's consolidated GMP guideline QALT/GL/MP/004 (effective 08-02-2023) compiles GMP requirements spread across the 1976 Rules; Schedule B-II GMP was historically WHO-based. | Background; the PIC/S transition supersedes much of this. |
| P3 | **2D barcode & serialization (Track & Trace phase 1)** | REG | S.R.O. 963(I)/2026 amends the Drugs (Labelling and Packaging) Rules 1978: registered products manufactured or imported **on or after 9 Oct 2026** must carry unique **GS1 2D DataMatrix barcodes and serial numbers**; earlier batches are exempt. Full track-and-trace is phased (an industry post cites ~6 years — unconfirmed). DRAP collected industry readiness data by 1 Sep 2025 and is integrating with its e-Services portal. | Every new batch now needs GTIN + batch + expiry + serial data. Pharmodry must at minimum hold product GTINs and expose GS1 batch data (implemented, see feature F2); unit-level serial generation and DRAP portal reporting depend on DRAP's technical specification (roadmap). |
| P4 | Pharmacovigilance | REG | Pharmacovigilance Rules 2022 (S.R.O. 540(I)/2022, 22 Apr 2022) oblige registration holders to establish PV systems and collect, evaluate and report AEs/ADRs/AEFI to the National Pharmacovigilance Centre; DRAP e-reporting system available. DRAP has reported that few companies have established PV centres. | Pharmacovigilance is outside the MVP (no PV module); recorded as roadmap item; complaint → PV triage hook planned. |
| P5 | Import dependence | Context | Estimates: ~85–90 % of APIs imported (DRAP policy notice: 15 % local); China ~60–70 % of API imports; India 30–40 % of raw materials. | Validates the stock-out-risk analytics (lead time vs. cover days) and supplier-risk features as high-value for Pakistani manufacturers. |

## 2. International frameworks (architecture-ready)

| # | Framework | Type | Key points used in the design |
|---|---|---|---|
| I1 | **PIC/S PI 041-1** Good Practices for Data Management and Integrity (in force 1 Jul 2021) | GUIDE | Data must be accurate, complete and reliable through its lifecycle; inspectors focus on audit trails, access control and data review. → append-only hash-chained audit trail, role-based access, review/approval workflows. |
| I2 | **WHO TRS 1033 Annex 4** Guideline on Data Integrity (2021; replaces TRS 996 Annex 5) | GUIDE | Sections on data governance, QRM, training, good documentation practices, computerised systems, data review and approval, CAPA. → ALCOA+ attributes captured on every regulated record. |
| I3 | **FDA 21 CFR Part 11** + "Scope and Application" guidance (2003) | REG (US) / GUIDE | Applies to electronic records/signatures used to meet predicate rules. FDA has said it is re-examining Part 11. → signature manifestation (signer, date/time, meaning), re-authentication, signature–record linking. |
| I4 | **EU GMP Annex 11** (2011) and **draft revision published 7 Jul 2025** (consultation closed 7 Oct 2025; final expected from 2026) with new **Annex 22 (AI)** and revised Chapter 4 | REG (EU) / draft | Draft expands audit trail, e-signature, cybersecurity, alarm management and AI expectations. → AI is assistive only, logged and labelled; final adoption status to be re-checked. |
| I5 | **FDA OOS guidance** (Level 2 revision, May 2022) | GUIDE | Phased investigation (laboratory → full-scale), limits on averaging and outlier tests. → OOS lifecycle with explicit laboratory and manufacturing phases; invalidation only with assignable lab error; system never concludes OOS itself. |
| I6 | **ICH Q9(R1)** Quality Risk Management (Jan 2023) | GUIDE | New emphasis on managing subjectivity, formality, risk-based decisions and **product availability risk**. → deterministic, explained risk scoring (stock-out risk) instead of opaque scores. |
| I7 | **PIC/S GMP Part I Chapter 1** (PE 009-17, 2023) — Product Quality Review | GUIDE | Annual PQR covering batches, deviations, OOS, CAPA effectiveness, changes, stability, complaints, recalls. Chapter 1 revision consulted until 3 Dec 2025. → PQR data pack (feature F3). |

## 3. What Pharmodry does **not** claim

* Using Pharmodry does **not** make a company GMP-, Part 11-, Annex 11- or DRAP-compliant. Compliance requires validated processes, CSV/CSA, SOPs, training, supplier qualification of the vendor and periodic review (see `docs/VALIDATION_NOTES.md`).
* The serialization support is **data readiness** (GTIN, GS1 element strings) — it is not a certified Level-3/Level-4 serialization system and does not report to DRAP's portal.
* Pharmacovigilance, regulatory submissions and controlled document management are **not** in this release.

## Sources (accessed 2026-10-17/18)

* DRAP — Notification of Amendments in the Drugs Licensing Registering and Advertising Rules 1976 (25 Aug 2025): https://www.dra.gov.pk/wp-content/uploads/2025/08/Notification-of-Amendments-in-the-Drugs-Licensing-Registering-and-Advertising-Rules-1976-25.08.2025.pdf
* The News (26 Feb 2026), "DRAP starts implementing global GMP guidelines for pharma industry": https://www.thenews.pk/print/1401521-drap-starts-implementing-global-gmp-guidelines-for-pharma-industry
* DRAP — GMP Guidelines (08 Feb 2023): https://www.dra.gov.pk/wp-content/uploads/2023/02/GMP-GUIDELINES-DRAP-GMP-08-Feb-2023.pdf
* DRAP — Orientation session on PIC/S GMP guidelines: https://www.dra.gov.pk/?p=69280
* APP (12 Oct 2026), "DRAP makes 2D barcodes mandatory on medicines": https://www.app.com.pk/?p=1290194
* ProPakistani (2 Jun 2026), digital verification system for medicines: https://propakistani.pk/2026/06/02/pakistan-to-introduce-digital-verification-system-for-all-medicines/
* DRAP notice (29 Aug 2025), Submission of details for 2-D barcode & serialization: https://www.dra.gov.pk/news_updates/regulatory_updates/general/submission-of-required-details-for-implementation-of-2-d-barcode-serialization-by-1st-september-2025
* DRAP — Pharmacovigilance Rules 2022 notification: https://dra.gov.pk/?p=5434
* RegDesk — DRAP national pharmacovigilance system overview: https://www.regdesk.co/blog/drap-guidelines-on-national-pharmacovigilance-system-overview/
* Nukta (2025), Pakistan pharma API import dependence: https://nukta.com/pakistan-pharma-stocks-surge-3-3x-since-2024-as-margins-hit-record-highs
* Geo TV, India trade suspension and pharma raw materials: https://www.geo.tv/latest/601885-suspension-of-india-trade-health-authorities-launch-emergency-plan-to-meet-pharma-needs
* PIC/S — Adoption and entry into force of PI 041-1: https://picscheme.org/en/news/adoption-and-entry-into-force-of-pics-guidance-on-good-pract
* WHO — TRS 1033 Annex 4, Guideline on data integrity: https://www.who.int/publications/m/item/annex-4-trs-1033
* FDA — Part 11, Scope and Application: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/part-11-electronic-records-electronic-signatures-scope-and-application
* GMP-Compliance.org — Drafts of EU GMP Annex 11, Annex 22 and Chapter 4 released for comment: https://www.gmp-compliance.org/gmp-news/drafts-of-eu-gmp-guideline-annex-11-annex-22-and-chapter-4-released-for-comment
* FDA — Investigating OOS Test Results for Pharmaceutical Production (May 2022): https://www.fda.gov/regulatory-information/search-fda-guidance-documents/investigating-out-specification-test-results-pharmaceutical-production
* FDA-hosted presentation on ICH Q9(R1): https://www.fda.gov/media/177720/download
* Swissmedic technical interpretation — Product Quality Reviews: https://www.swissmedic.ch/dam/swissmedic/fr/dokumente/bewilligungen/inspektorat/i-smi_ti_14e_productqualityreviews.pdf.download.pdf/i-smi_ti_14e_productqualityreviews.pdf
* TGA — PIC/S GMP Guide Part I (PE 009-17): https://www.tga.gov.au/sites/default/files/manuf-pics-gmp-medicines-part1.pdf
