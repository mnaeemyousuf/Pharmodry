# Known Limitations (demo / MVP release)

Read this before demonstrating Pharmodry or planning a pilot. Full details: `docs/AUDIT/UNRESOLVED_DEFECTS.md` and `docs/AUDIT/MVP_REMEDIATION_BACKLOG.md`.

## Regulatory status

- Pharmodry is **not validated** for GMP use. It has not been inspected or approved by DRAP, the FDA, the EMA or any PIC/S authority.
- The technical controls are designed to *support* Part 11 / Annex 11 / PIC/S data-integrity expectations: audit trail, e-signatures, segregation of duties and access control. Compliance still requires validation, SOPs and training by the user company.

## Not implemented in this release

| Area | What is missing | Workaround in the demo |
|---|---|---|
| Distribution & recall | Customer/distributor register, real recall workflow | Mock recall shows the dispatched quantities and states that customer detail is held in the ERP |
| Serialization | Serial numbers, aggregation, regulator reporting (DRAP S.R.O. 963(I)/2026) | GTIN, batch and expiry data readiness, plus the GS1 element string |
| Document control, training, change control, complaints, stability, OOT | Modules not built | The PQR lists these as "not captured" |
| Pharmacovigilance, sales, accounting | Not in scope (no roles, no manuals) | — |
| E-mail notifications | Channel is a stub | In-app notifications |
| SSO / MFA | Not implemented | Local passwords with lockout |
| ERP integration, import wizard | Not implemented | Seeded data |
| Object storage, malware scanning | Local disk storage only | Uploads are type-checked and hashed |

## Not verified in the build environment

- Live Mistral AI responses: no API key was available. The demo shows the deterministic "AI provider not configured" answers, which still contain computed facts and links.
- Docker images and the compose stack: Docker was not installed.
- Performance and load targets, Redis/BullMQ scheduling, browsers other than Microsoft Edge, mobile layouts, backup and restore.

## Demo-data caveats

- All data is fictional. Six months of history are labelled *migrated*, and their signatures carry the meaning `MIGRATED_RECORD`.
- GTINs use the GS1 restricted-circulation prefix `02` and are not real trade items. OMZ-020 deliberately has no GTIN.
- Some certificates are deliberately expired or about to expire, and some CAPAs and deviations are deliberately overdue, so that the Command Center has content.
- The demo password is a documented development default. Do not reuse it, and never seed demo data into a production database.
- Dates in the UI are shown in Pakistan time (Asia/Karachi).
