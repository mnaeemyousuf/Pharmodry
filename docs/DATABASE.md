# Pharmodry — Database

PostgreSQL (developed and tested on 17.5, UTF-8), accessed through Prisma 6. Schema: `apps/api/prisma/schema.prisma` (58 models, 36 enums). Migrations: `apps/api/prisma/migrations/`.

| Migration | Content |
|---|---|
| `20261017071553_init` | All tables, enums, foreign keys, indexes |
| `20261017071600_compliance_controls` | Append-only triggers, CHECK constraints, `pg_trgm` index (hand-written SQL) |
| `20261018090000_product_gtin` | `products.gtin` + unique `(tenantId, gtin)` |

> `prisma migrate diff` reports the trigram index as drift because Prisma cannot model it. This is expected; never "fix" it by generating a migration that drops it.

## Model groups

| Area | Models |
|---|---|
| Tenancy & org | `Tenant` (settings JSON), `Site`, `Department`, `ProductionLine`, `Warehouse`, `BinLocation`, `NumberSequence` |
| Identity & access | `User`, `Session` (refresh-token families), `Permission` (global catalogue), `Role`, `RolePermission`, `UserRole` (optional `siteId` scope) |
| Master data | `UnitOfMeasure`, `ProductCategory`, `DosageForm`, `Product` (incl. `gtin`), `Material`, `Supplier`, `SupplierMaterial` (approved supplier list), `Equipment`, `Calibration`, `Bom`, `BomLine`, `Routing`, `RoutingStep` (eBMR template), `TestMethod`, `QcSpecification`, `QcSpecTest`, `MasterDataVersion` (append-only snapshots) |
| Supply | `PurchaseOrder`, `PurchaseOrderLine`, `GoodsReceipt`, `GoodsReceiptLine` |
| Inventory | `InventoryLot` (one lot at one location; status, quantity, reserved, optimistic `version`), `InventoryTransaction` (append-only ledger), `MaterialReservation` |
| Production | `ProductionPlan`, `ProductionPlanLine`, `Batch`, `BatchStep`, `BatchStepCorrection` (append-only), `BatchMaterialConsumption` |
| Quality | `QcSample`, `QcResult`, `OosInvestigation`, `Deviation`, `RootCauseAnalysis`, `Capa`, `CapaAction` |
| Records & evidence | `AuditEvent` (hash-chained, append-only), `ElectronicSignature` (append-only), `Attachment` (SHA-256, storage key) |
| Notifications | `Notification` (with `dedupeKey`), `NotificationPreference` |
| AI | `AiConversation`, `AiMessage`, `AiFeedback` (purged after the tenant's `ai.retentionDays`) |
| Integration | `IntegrationEvent` (reserved for ERP adapters; unused in this release) |

## Multi-tenancy

Every tenant-owned table has a `tenantId` column, and composite indexes lead with `tenantId`. A Prisma client extension (`apps/api/src/infrastructure/prisma/tenant-scope.extension.ts`) adds `tenantId` to the filters and inserts of tenant-scoped models whenever a tenant context exists, and throws if code supplies a different tenant. Cross-tenant ids therefore return 404. Uniqueness is tenant-scoped (e.g. `@@unique([tenantId, code])`, `@@unique([tenantId, gtin])`).

## Database-enforced controls

These hold even if application code is bypassed:

1. **Append-only tables.** `audit_events`, `electronic_signatures`, `inventory_transactions`, `master_data_versions` and `batch_step_corrections` reject `UPDATE`, `DELETE` and `TRUNCATE` (trigger function `pharmodry_reject_mutation`). The e2e suite verifies this.
2. **Inventory integrity.** `quantity >= 0`, `0 <= reservedQuantity <= quantity`, and a lot references a material or a product matching its `itemType`.
3. **Release evidence.** A batch in `RELEASED`/`REJECTED` must have `qaDecisionById` and `qaDecisionAt`. A lot in `RELEASED` must have `dispositionById`.
4. **Audit hash chain.** Each `AuditEvent` stores `hash = sha256(prevHash + canonical event)`; writers take `pg_advisory_xact_lock` per tenant so the chain stays linear. `GET /api/v1/audit/verify` recomputes it.

## Concurrency

- `InventoryLot.version` and `Batch.version` support optimistic updates (`updateMany where version = n`). A lost race returns `409 CONCURRENT_MODIFICATION`.
- QA batch decisions lock the batch row (`SELECT … FOR UPDATE`) inside the transaction.

## Local databases (development)

`npm run db:start` launches an embedded PostgreSQL 17 cluster on port 5433. Its data lives in `.data/pg`, and it uses the dev-only credentials `pharma360` / `pharma360_dev`.

| Database | Purpose |
|---|---|
| `pharma360_demo` | Current demo database (seeded 2026-10-18, includes GTINs). `apps/api/.env` points here. |
| `pharma360_dev` | Earlier demo seed (before GTINs). Kept, not reset. |
| `pmd_e2e_<timestamp>` | Created and dropped by every `npm run test:e2e` (`E2E_KEEP_DB=true` keeps it). |
| `pmd_ui_<timestamp>` | Created and dropped by every `npm run test:ui` (`KEEP_DB=true` keeps it). |

Create a new demo database without touching existing ones (from `apps/api`):

```bash
echo "CREATE DATABASE pharma360_demo2 WITH ENCODING 'UTF8' TEMPLATE template0;" | npx prisma db execute --url "postgresql://pharma360:pharma360_dev@localhost:5433/postgres" --stdin
```

```bash
DATABASE_URL="postgresql://pharma360:pharma360_dev@localhost:5433/pharma360_demo2" npx prisma migrate deploy
```

```bash
DATABASE_URL="postgresql://pharma360:pharma360_dev@localhost:5433/pharma360_demo2" npm run db:seed
```

`npm run db:reset` runs `prisma migrate reset` and **destroys all data in the target database**. Use it only on disposable local databases. The seed refuses to run when `NODE_ENV=production` unless `ALLOW_DEMO_SEED=true`, and it will not reseed a database that already contains the demo tenant.

## Seed data

`apps/api/prisma/seed.ts` loads fictional data only:

- **`seed/master.ts`** — tenants NovaCure Pharmaceuticals (Karachi) and Zenith Labs (an isolation-test tenant), 21 demo users, roles, master data, specifications, BOMs, routings, suppliers and equipment. GTINs use the GS1 restricted-circulation prefix `02` and are not real.
- **`seed/history.ts`** — six months of history, labelled as migrated legacy records with `MIGRATED_RECORD` signatures.
- **`seed/live.ts`** — today's scenarios A–E, executed through the real application services (receipt, QC, release, OOS, deviation, shortage, in-progress batch).

## Backups and retention (production guidance)

Use managed PostgreSQL point-in-time recovery, and keep backups for at least the record-retention period your QMS requires. Restores must preserve the append-only tables; verify the audit chain (`/audit/verify`) after any restore. Backup and restore have not been exercised in this release.
