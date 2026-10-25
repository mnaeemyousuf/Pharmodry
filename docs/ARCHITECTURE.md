# Pharmodry — Architecture

## 1. Style: modular monolith

One deployable API (NestJS) and one web app (Next.js). Domain modules have explicit boundaries (own controller → service → Prisma access, own DTOs) and talk to each other only through exported services, so any module can later be extracted into a service without rewriting callers.

```
apps/
  api/                 NestJS REST API (/api/v1), Prisma, jobs, AI
    prisma/            schema.prisma, migrations, seed
    src/
      common/          context (CLS), guards, filters, interceptors, pagination, errors
      infrastructure/  prisma (tenant-scope extension), storage, queue (BullMQ / in-process), llm providers
      modules/
        auth  core(settings, sequences, access)  organizations  users  master-data  suppliers
        procurement  inventory  sampling  production  quality(qc, oos)
        deviations  capa  signatures  audit  notifications  attachments  jobs(scans)
        analytics(dashboard, command center, search, traceability, PQR)  ai
    test/              Jest + Supertest e2e (embedded PostgreSQL)
  web/                 Next.js 15 App Router, Tailwind, shadcn-style components,
                       TanStack Query, React Hook Form + Zod, Recharts
    e2e/               Playwright scenarios
packages/
  types/               Status enums, permission codes, shared DTO types (built to CJS)
  validation/          Zod schemas shared by web forms and API (built to CJS)
  config/              tsconfig bases
  ui/                  Design tokens (status colours) shared by web and reports
infrastructure/        docker-compose, Dockerfiles, embedded dev Postgres launcher, isolated test-env runner
docs/
```

## 2. Request pipeline (API)

```
HTTP → helmet / CORS / rate-limit
     → ClsMiddleware: correlationId, ip, user-agent
     → JwtAuthGuard: verify access token, load user + effective permissions (per-site) → CLS(tenantId,userId)
     → PermissionsGuard: @RequirePermissions(...) (any-site check)
     → ValidationPipe (class-validator DTOs, whitelist, forbidNonWhitelisted)
     → Controller (thin) → Domain service (rules, site-scope check, transaction)
         → Prisma (tenant-scoping extension) + AuditService + SignatureService + NotificationService
     → ResponseInterceptor → { data, meta }
     → AllExceptionsFilter → { error: { code, message, details, correlationId } }
```

### Tenant isolation (defence in depth)
1. Every tenant-owned table has `tenantId` + composite indexes starting with `tenantId`.
2. Services always filter by the tenant from request context.
3. A Prisma **client extension** injects/validates `tenantId` on every top-level operation of tenant-scoped models when a tenant context exists (reads get `where.tenantId`, creates get `data.tenantId`; a mismatching `tenantId` throws). Cross-tenant ids therefore resolve to *404*, never to another tenant's data.
4. E2E tests prove cross-tenant reads/writes fail.

### Authorization
`Permission` (global catalogue, e.g. `batch.release`) ← `RolePermission` → `Role` (per tenant, configurable) ← `UserRole` (optional `siteId` scope). Guards check *codes*, never role names. Services call `user.require(permission, siteId)` on the `AuthPrincipal` for site-scoped actions; list endpoints narrow by `user.sitesFor(permission)`. `@RequirePermissions(...)` requires ALL listed codes.

## 3. Regulated-record controls

| Control | Implementation |
|---|---|
| Audit trail | `AuditService.record(tx, …)` inside the same DB transaction as the change. Rows hold before/after JSON, reason, correlation id, IP, signature link and a SHA-256 hash chained to the tenant's previous event (`pg_advisory_xact_lock` per tenant keeps the chain linear). A PostgreSQL trigger rejects `UPDATE`/`DELETE`/`TRUNCATE` on `audit_events`. `GET /audit/verify` re-computes the chain. |
| E-signatures | `SignatureService.sign(tx, {password, meaning, reason, entity…})` re-verifies the password, stores `ElectronicSignature` (signer name snapshot, meaning, reason, record hash) separately and links it to the audit event. |
| Corrections | eBMR step values and QC results are frozen after completion/review; corrections create `BatchStepCorrection` rows / new result versions with reason, and audit events. |
| Master-data versions | `MasterDataVersion` snapshots each change of product/material/supplier/spec with incremented `version`. |
| No hard deletes | Regulated entities expose `cancel`/`void` actions; no DELETE endpoints. |
| Status changes | Only through explicit service methods guarded by a state machine (`packages/types` transition tables). |

## 4. Critical transactions

**QA batch decision** (`POST /batches/:id/qa-release`, body `decision: RELEASE | REJECT`) — one `prisma.$transaction` with a row lock on the batch (`SELECT … FOR UPDATE`):
verify permission + site → batch status `AWAITING_QA` → all finished-product QC samples `APPROVED` with conclusion PASS → no open or confirmed OOS → no open deviation linked to the batch (any severity) → all eBMR steps requiring verification verified → yield inside tolerance or justified → re-authenticate & create e-signature → batch `RELEASED` → FG lots `QUARANTINE → RELEASED` + inventory transactions → audit events → notifications. Any failure rolls back everything.

Same pattern for **material lot disposition**, **QC approval**, **deviation closure**, **CAPA closure**, **OOS QA approval**.

## 5. Inventory model

`InventoryLot` = one lot at one location (warehouse + bin) with status and quantity; `reservedQuantity` tracks soft allocations. All quantity changes go through `InventoryLedger.post(tx, movement)` which writes an `InventoryTransaction` (signed qty, balance after, status from/to, reference) and updates the lot with optimistic `version` check. FEFO allocation orders released lots by `expiryDate`, then `retestDate`, then `createdAt`, skipping expired / retest-due lots.

## 6. Jobs & notifications

`QueueService` abstraction: BullMQ (Redis) when `REDIS_URL` is set, in-process interval scheduler otherwise. Scheduled scans: expiry (30/60/90/expired → auto-status `EXPIRED`), safety stock, overdue CAPA/deviation, calibration due, QA-release backlog. `NotificationService` resolves recipients by permission + site, de-duplicates per `dedupeKey`, honours user preferences; channel interface (`InAppChannel`, `EmailChannel` stub with SMTP-ready config).

## 7. AI architecture (summary — see AI_ARCHITECTURE.md)

```
Question → permission check (ai.copilot.use) → intent detection (rules, LLM fallback constrained to an enum)
  → controlled retrieval tools (each re-checks domain permission, returns computed facts + citations)
  → sanitised, delimited context → LLMProvider (Mistral) → answer + citations → AiMessage log (retention policy)
```
AI services have read-only Prisma access via dedicated query services; no AI code path imports a mutating domain service.

## 8. Integration & extensibility

* `StorageProvider` interface — local-disk driver ships in this release; S3-compatible / Azure Blob drivers are not yet implemented.
* `LLMProvider` (Mistral, disabled fallback).
* `IntegrationEvent` table (source, payload ref, status, retries, error) exists in the schema for future ERP adapters; no ERP adapter is implemented in this release.
* Auth is local password + JWT now; Entra ID (OIDC) SSO and MFA are roadmap items.

## 9. Deployment

Development: embedded PostgreSQL 17 launcher (`npm run db:start`, port 5433) or `docker compose -f infrastructure/docker-compose.yml up` (Postgres 17 + Redis 7; not verified in the build environment). Production (Azure): App Service / Container Apps for `api` and `web`, Azure Database for PostgreSQL Flexible Server, Azure Cache for Redis, Blob Storage, Key Vault for secrets, Application Insights for logs. See DEPLOYMENT.md.

## 10. Key technology choices

| Concern | Choice | Why |
|---|---|---|
| API | NestJS 11 | Modules map naturally to domains; DI aids testability |
| ORM | Prisma 6 | Typed schema/migrations; client extensions for tenant scoping |
| Validation | class-validator DTOs (API), Zod (web + shared) | Nest-native DTO + Swagger generation; Zod for forms |
| Password hashing | Node `scrypt` (N=2^15) | No native build deps, memory-hard |
| Web | Next.js 15 App Router, client-side data via TanStack Query | `/api/v1` forwarded by a same-origin route handler (`app/api/v1/[...path]`) reading `API_URL` at runtime → refresh cookie stays first-party |
| Charts | Recharts | Requested; simple, themable |
