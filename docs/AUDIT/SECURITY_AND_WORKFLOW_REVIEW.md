# Security and GMP Workflow Review

**Method.** Code review of the guards, services and transactions. Every claimed control was then exercised by an automated test where possible: API e2e suites S, X, A, B, M, T and the Playwright scenarios. This was an internal review by the development agent, **not** an independent penetration test or a GMP audit.

## A. Security findings

| ID | Area | Finding | Severity | Status |
|---|---|---|---|---|
| S-01 | Sessions | Profile "revoke session" sent the request without a bearer token, so revocation silently failed | High | Fixed |
| S-02 | Sessions | Self-service password change did not revoke other sessions (an attacker holding a stolen refresh token kept access) | High | Fixed; test in S |
| S-03 | Evidence | Attachment download route shadowed by the list route (availability defect, not a leak — the request was refused) | Medium | Fixed; test in M |
| S-10 | Authorization | Permission `inventory.issue` was defined but not enforced; issuing materials used `batch.reserve`, so planners and supervisors could issue stock (weak warehouse/production segregation) | Medium | Fixed: API and UI require `inventory.issue`; test in S |
| S-11 | Availability | Token refresh was limited to a fixed 30 requests/min per IP. Every full page load refreshes, so users behind one office NAT IP (or parallel browser tests) were signed out once the shared budget was exceeded | Medium | Fixed: `REFRESH_RATE_LIMIT_PER_MINUTE` (default 300); found during manual screenshot capture |
| S-12 | UI / authorization consistency | Screens shown to roles whose API calls were refused (403): Traceability for roles without `inventory.view` (page stuck loading), PQR for roles without `batch.view`, QC section of the printable batch record without `qc.view`, supplier filter on Goods receipts without `supplier.view`. The server correctly refused every call — no data leaked — but users saw broken pages | Low (no leak) | Fixed: menu entries and buttons now require all needed permissions, pages degrade gracefully, error states replace endless loading. The manual-capture script now records every 403/5xx per role and screen; the final capture reported none |
| S-04 | Auth | No MFA / SSO | Medium | Open (O-04) |
| S-05 | Uploads | No malware scanning. Type checks use extension + MIME + magic bytes; files are stored with SHA-256, write-once, and traversal-safe keys | Medium | Open (O-05) |
| S-06 | Web | API CSP allows `'unsafe-inline'` for scripts/styles (needed by Swagger UI); the web app relies on Next defaults plus frame/nosniff/referrer headers | Low | Accepted for MVP. Nonce-based CSP recommended. |
| S-07 | Secrets | Production bundle checked: no secret values. Demo password is documented and dev-only; the seed refuses production | Info | OK |
| S-08 | Rate limiting | Configured (global and login), not load-tested | Low | Open (O-08) |
| S-09 | Logging | No central log shipping or alerting configured | Low | Deployment task |

**Verified controls (tests):**
- 401 without a token
- Generic login errors
- Lockout and admin unlock
- Refresh rotation with reuse detection and family revocation
- CSRF header requirement
- Unknown-field and malformed-id rejection
- Security headers
- Cross-tenant 404s and search isolation
- Site-scoped denial
- Role denials for analyst, operator, management viewer, warehouse and procurement users

## B. GMP workflow review

Each safety rule from the specification was challenged by attempting the unsafe action:

| Unsafe action attempted | Expected | Result | Test |
|---|---|---|---|
| Use quarantined material in production | Refused | Refused — reservation uses released lots only; shortage error even with quarantined stock | A, X |
| QA release of a lot before QC approval | Refused with reasons | Refused; blockers listed | A, UI1 |
| QA release of a batch with an open/confirmed OOS | Refused | Refused (`RELEASE_BLOCKED`) | B, UI2 |
| Replace the flagged OOS result while the investigation is open | Refused | Refused | B |
| Skip OOS phases; invalidate without an assignable lab error; owner self-approves the conclusion | Refused | Refused | B |
| Analyst approves own results; operator verifies own step; PO creator approves own PO | Refused (SoD) | Refused | X, A, S |
| Use equipment with expired calibration (BLOCK policy) | Refused | Refused | X |
| Close CAPA without a successful effectiveness check | Refused | Refused; failure counted | X |
| Receive from a suspended supplier / unapproved material / expired material | Refused | Refused | X |
| Switch receipt default away from QUARANTINE via settings | Not applied | Quarantine kept | M |
| Edit or delete audit events / signatures in the database | Refused by DB | Rejected by trigger | S |
| E-signature with the wrong password | No change; attempt audited | Rolled back and audited | S |
| Warehouse user releases a batch | 403 | 403 | A |
| AI decides or changes a record | Impossible | AI endpoints return facts/suggestions only. The absence of write paths is verified by code inspection (no negative test yet — O-09). | X |

**Design decisions that intentionally go beyond the specification:**

- Any open deviation linked to a batch blocks release. The original design allowed a QA-accepted Minor deviation; this was removed as the safer default.
- `receiptDefaultStatus` is excluded from editable settings entirely, rather than merely audited, so quarantine on receipt cannot be bypassed through configuration.
- OOS conclusions and batch decisions always require an e-signature with password re-entry, regardless of risk level.

## C. Residual workflow risks

1. **Recall depth.** Customer-level distribution is not captured, so a real recall needs ERP shipment data (the UI states this).
2. **Paper/hybrid processes.** Line clearance, label reconciliation and dispensing booth checks are not modelled as separate controlled steps beyond the eBMR template.
3. **Training qualification.** The system does not check that a user is trained on an SOP before letting them execute a step.
4. **Migrated history** is labelled, but a real migration needs its own validation.
