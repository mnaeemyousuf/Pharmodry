# Pharmodry — Security

This page describes the controls implemented in this release and the remaining work before production. It is not a penetration-test report, and the application has not been independently security-assessed. Findings from this audit are listed in `docs/AUDIT/SECURITY_AND_WORKFLOW_REVIEW.md`.

## Authentication

| Control | Implementation |
|---|---|
| Password storage | Node `scrypt` (N = 2^15, 64-byte key, per-user random salt). Parameters are stored with each hash so they can be raised later. |
| Password policy | Minimum 10 characters with upper-case, lower-case and a digit (`PasswordService.validatePolicy`). History, expiry and breach screening are not yet implemented. |
| Lockout | 5 consecutive failures lock the account for 15 minutes; an administrator can unlock it (`users/:id/unlock`). Wrong password and unknown user return the same generic message. Every failure and lock is audited. |
| Rate limiting | Login: `LOGIN_RATE_LIMIT_PER_MINUTE` (default 10/IP). Token refresh: `REFRESH_RATE_LIMIT_PER_MINUTE` (default 300/IP — every full page load refreshes, and office users often share one NAT IP). Global: `RATE_LIMIT_PER_MINUTE` (default 600/IP). Behind a reverse proxy, `trust proxy` makes limits apply to the forwarded client IP. |
| Access token | JWT (HS256) signed with `JWT_ACCESS_SECRET` (≥ 32 characters, enforced in production). 15 min TTL. Held in memory by the web app, never in `localStorage` (which stores only table display preferences). |
| Refresh token | Opaque random token in the httpOnly cookie `pmd_rt` (`SameSite=Strict`, `path=/api/v1/auth`, `Secure` in production). Only a hash is stored. It rotates on every use. Replaying a rotated token revokes the whole token family (`REUSE_DETECTED`). |
| CSRF | Cookie-authenticated endpoints require `X-Requested-With: pharmodry`; the cookie is SameSite=Strict and path-scoped. |
| Sessions | Users can list and revoke their sessions. An administrator password reset revokes all of the user's refresh tokens. A self-service password change revokes every other session but keeps the current one. |
| Not yet implemented | MFA, SSO (Entra ID / OIDC), password-breach screening, idle-session timeout in the UI. |

## Authorization

- About 60 permission codes in a global catalogue (`packages/types/src/permissions.ts`), grouped into per-tenant configurable roles (19 default roles), with optional site scope per assignment.
- Guards check permission codes, never role names. `@RequirePermissions` requires all listed codes. Services re-check site scope (`user.require(code, siteId)`) and narrow lists to the user's sites.
- The UI hides actions the user cannot perform, but the server is the authority. E2E tests call APIs directly with under-privileged tokens and expect `403`.
- **Segregation of duties is enforced server-side:**
  - a PO creator cannot approve their own PO
  - an operator cannot verify their own eBMR step
  - an analyst cannot review or approve their own QC results
  - an OOS investigation owner cannot give the QA conclusion
  - QA release is a separate permission (`batch.approve`) not granted to production roles

## Tenant isolation

Tenant identity comes only from the token. A Prisma extension injects and validates `tenantId` on tenant-scoped models, and composite unique keys include `tenantId`. The e2e suite proves that a second tenant (Zenith) cannot read or modify NovaCure records: it gets 404s, and list results don't leak across tenants.

## Data integrity (ALCOA+ support)

- **Audit trail.** Every create, change and status transition is recorded in the same database transaction. Each event holds who, when (server time), before/after values, reason, IP, user agent and correlation id, and is hash-chained. Database triggers make `audit_events`, `electronic_signatures`, `inventory_transactions`, `master_data_versions` and `batch_step_corrections` append-only.
- **Electronic signatures.** Signing requires password re-entry inside the transaction. The signature stores the signer's name snapshot, meaning, reason, timestamp and record hash, and is linked to the audit event. Failed signature attempts are audited.
- **No hard deletes of regulated records.** eBMR and QC corrections are new rows with a reason. Master-data changes create versions.
- **Server time only.** The client cannot supply timestamps for regulated events.

> These are technical controls that *support* 21 CFR Part 11 / EU GMP Annex 11 / PIC/S PI 041-1 expectations. They do not by themselves make a system compliant. Compliance also requires validation (CSV/CSA), SOPs, training, access reviews and supplier assessment — see `docs/VALIDATION_NOTES.md`.

## Input handling and web security

- DTO validation with a whitelist (`forbidNonWhitelisted`), plus Zod on forms. Prisma uses parameterised queries; the few raw SQL statements use tagged templates.
- **Attachments:** only these types are accepted, checked by extension, MIME type and magic bytes: PDF, PNG, JPEG, XLSX, DOCX, CSV. Size limit is `MAX_UPLOAD_BYTES` (10 MB). Files get SHA-256 hashes, are written once (`wx`), and use path-traversal-safe storage keys. Downloads are permission-checked. Virus scanning is **not** implemented.
- **API:** Helmet headers (CSP `default-src 'self'`), `x-powered-by` disabled, and CORS limited to `CORS_ORIGINS`.
- **Web:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a restrictive `Permissions-Policy`. The browser calls only same-origin `/api/v1`, which the Next.js route handler forwards to `API_URL`.
- CSV exports neutralise spreadsheet formula injection (leading `= + - @`).

## Secrets

- Secrets come only from environment variables (Key Vault or equivalent in production). `.env` files are local only and excluded from Docker builds (`.dockerignore`).
- The Mistral API key, database credentials and JWT secret exist only in the API process. The web bundle contains no secrets: its only public variable is `NEXT_PUBLIC_DEMO_MODE`.
- The demo password (`SEED_DEMO_PASSWORD`, dev default documented in `docs/DEMO`) is for fictional local data only. The seed refuses to run in production unless explicitly allowed.

## AI-specific controls

See `docs/AI_ARCHITECTURE.md`. In summary:

- AI calls are server-side only. Retrieval tools re-check the user's permissions.
- Prompt context is sanitised and delimited, and instruction-like text and e-mail addresses are removed.
- AI output is labelled and advisory. It can never change regulated records or make GMP decisions.
- Prompts and answers are logged with a retention period.

## Logging and monitoring

Structured JSON logs with correlation ids. Passwords, tokens and secrets are never logged. Production should ship logs to a central store (e.g. Application Insights) and alert on lockouts, `REUSE_DETECTED`, audit-chain verification failures and 5xx rates. Alerting is not configured in this release.

## Before production

1. Independent penetration test and dependency/SAST scanning in CI.
2. MFA/SSO, password-policy hardening, idle timeout.
3. Malware scanning for uploads; move to object storage with encryption at rest.
4. TLS everywhere, `COOKIE_SECURE=true`, HSTS at the edge, WAF.
5. Periodic access reviews and a documented user-provisioning SOP.
6. Backup/restore tests including audit-chain verification.
