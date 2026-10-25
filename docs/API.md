# Pharmodry — REST API

Base path `/api/v1`. Interactive OpenAPI (Swagger UI) at **`/api/docs`**, raw JSON at `/api/docs-json` (served by the API process, e.g. `http://localhost:4100/api/docs`). Swagger is the authoritative contract; this page explains conventions and lists the resource groups as implemented in this release.

## Conventions

| Topic | Rule |
|---|---|
| Authentication | `Authorization: Bearer <access token>` (JWT, 15 min default). Obtain via `POST /auth/login`; renew via `POST /auth/refresh` using the `pmd_rt` httpOnly cookie (path `/api/v1/auth`, SameSite=Strict). |
| CSRF | Cookie-based calls (`/auth/refresh`, `/auth/logout`) require header `X-Requested-With: pharmodry`. |
| Authorization | Every endpoint declares permission codes (`@RequirePermissions`, ALL required). Services re-check site scope. Missing permission → `403 FORBIDDEN`. |
| Tenancy | Tenant comes from the token, never from the request. Ids from another tenant resolve to `404`. |
| Success envelope | `{ "data": …, "meta": { page, pageSize, total, totalPages } }` (meta on lists only). |
| Error envelope | `{ "error": { "code", "message", "details", "correlationId" } }`. Business-rule failures are `422 RULE_VIOLATION` / `RELEASE_BLOCKED` with `details.reasons[]` (`code`, `message`, `href`). Concurrency conflicts are `409`. |
| Validation | DTO whitelist with `forbidNonWhitelisted` — unknown fields are rejected with `400`. |
| Lists | `page` (1), `pageSize` (25, max 200), `sort=field:asc|desc`, `q` (free text), `status` (comma-separated), `siteId`, plus resource-specific filters (see Swagger). |
| E-signature | Signing actions take the current password and an optional reason in the body, e.g. `{ "password": "…", "reason": "…" }` (plus action fields). The password is re-verified inside the same transaction as the change; failed attempts are audited. The signature meaning is fixed by the action. |
| Exports | `…/export` endpoints return `text/csv` and write an `EXPORT` audit event. |
| Rate limits | Global `RATE_LIMIT_PER_MINUTE` (default 600/IP/min); login `LOGIN_RATE_LIMIT_PER_MINUTE` (default 10). |
| Correlation | A client-supplied `x-correlation-id` header (8–64 word characters) is honoured, otherwise one is generated. It appears in error envelopes, logs and audit events. |

## Resource groups

| Group | Endpoints (method path) | Key permissions |
|---|---|---|
| Health | `GET /health` (public) | — |
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/sessions`, `DELETE /auth/sessions/:familyId`, `POST /auth/change-password` | authenticated |
| Organisation | `GET /organization`, `PATCH /organization/settings`, `GET/POST /sites`, `PATCH /sites/:id`, `GET/POST /departments`, `GET/POST /warehouses`, `POST /warehouses/:id/bins`, `GET /production-lines` | `admin.tenant.manage`, `admin.site.manage` |
| Users & roles | `GET /users`, `GET /users/directory`, `POST /users`, `PATCH /users/:id`, `PUT /users/:id/roles`, `POST /users/:id/unlock`, `POST /users/:id/reset-password`, `GET /roles`, `GET /permissions`, `POST /roles`, `PUT /roles/:id/permissions` | `admin.user.manage`, `admin.role.manage` |
| Master data | `GET /master-data/lookups`, `GET /master-data/versions/:entityType/:entityId`; products (`GET/POST /products`, `GET/PATCH /products/:id`, `POST /products/:id/boms`, `POST /products/:id/routings`); materials; equipment (+ `POST /equipment/:id/calibrations`); specifications; `POST /test-methods` | `masterdata.view`, `product.manage`, `material.manage`, `equipment.manage`, `spec.manage` |
| Suppliers | `GET/POST /suppliers`, `GET/PATCH /suppliers/:id`, `POST /suppliers/:id/status`, `POST /suppliers/:id/materials` | `supplier.view`, `supplier.manage`, `supplier.approve` |
| Procurement | `GET/POST /purchase-orders`, `GET /purchase-orders/:id`, `POST /purchase-orders/:id/approve`, `POST /purchase-orders/:id/cancel` | `procurement.po.view`, `procurement.po.create`, `procurement.po.approve` |
| Goods receipt | `GET/POST /goods-receipts`, `GET /goods-receipts/:id` — receipt always creates lots in `QUARANTINE` and requests QC samples | `inventory.receive` |
| Inventory | `GET /inventory/lots`, `GET /inventory/lots/export`, `GET /inventory/lots/:id`, `GET /inventory/lots/:id/release-blockers`, `POST /inventory/lots/:id/{transfer,adjust,disposition,block}`, `GET /inventory/movements`, `GET /inventory/stock-summary` | `inventory.view`, `inventory.transfer`, `inventory.adjust`, `inventory.release` |
| QC | `GET /qc/samples`, `GET /qc/samples/:id`, `POST /qc/samples/:id/{collect,results,submit,review,approve}` | `qc.view`, `qc.sample.collect`, `qc.result.enter`, `qc.result.review`, `qc.result.approve` |
| OOS | `GET /oos`, `GET /oos/:id`, `POST /oos/:id/advance`, `POST /oos/:id/link-deviation`, `POST /oos/:id/qa-approve` | `oos.view`, `oos.investigate`, `oos.approve` |
| Production plans | `GET/POST /production-plans`, `GET /production-plans/availability`, `GET /production-plans/:id`, `POST /production-plans/:id/approve` | `production.plan.view`, `production.plan.manage`, `production.plan.approve` |
| Batches / eBMR | `GET/POST /batches`, `GET /batches/export`, `GET /batches/:id`, `GET /batches/:id/release-blockers`, `POST /batches/:id/{reserve,unreserve,issue-materials,start,complete,qa-release,close,cancel}`, `POST /batches/:id/steps/:stepId/{start,complete,verify,corrections}` | `batch.view`, `batch.create`, `batch.reserve`, `inventory.issue`, `batch.start`, `batch.execute`, `batch.verify`, `batch.complete`, `batch.approve` |
| Deviations | `GET/POST /deviations`, `GET/PATCH /deviations/:id`, `POST /deviations/:id/{submit,start-review,classify,investigation,root-cause,approve-root-cause,capa-decision,close,cancel}` | `deviation.view`, `deviation.create`, `deviation.investigate`, `deviation.approve` |
| CAPA | `GET/POST /capas`, `GET /capas/:id`, `POST /capas/:id/actions`, `POST /capas/:id/actions/:actionId/complete`, `POST /capas/:id/{submit-effectiveness,effectiveness,close,cancel}` | `capa.view`, `capa.create`, `capa.manage`, `capa.verify`, `capa.close` |
| Signatures | `GET /signatures/:entityType/:entityId` | view permission of the entity |
| Audit | `GET /audit/events`, `GET /audit/verify` (hash-chain check), `GET /audit/export` | `audit.view`, `audit.export` |
| Attachments | `GET/POST /attachments/:entityType/:entityId`, `GET /attachments/file/:id` | view/edit permission of the entity |
| Notifications | `GET /notifications`, `POST /notifications/read`, `GET/PUT /notifications/preferences` | authenticated |
| Analytics | `GET /analytics/dashboard`, `GET /analytics/command-center`, `GET /analytics/capa-kpis`, `GET /analytics/inventory-risk`, `GET /analytics/expiry-risk` (+ `/export`), `GET /analytics/pqr?productId&from&to` | `analytics.view`, `commandcenter.view` |
| Traceability | `GET /traceability/search?q=`, `GET /traceability/lots/:id` (forward), `GET /traceability/batches/:id` (backward + GS1 string), `GET /traceability/batches/:id/recall`, `GET /traceability/batches/:id/recall/export` | `batch.view` + `inventory.view` (+ `report.export`) |
| Search | `GET /search?q=` (global, permission-filtered) | authenticated |
| AI | `GET /ai/status`, `POST /ai/copilot/ask`, `GET /ai/copilot/conversations`, `POST /ai/messages/:id/feedback`, `POST /ai/deviations/:id/assist`, `POST /ai/capa/draft`, `GET /ai/usage` | `ai.copilot.use`, `ai.assist.use`, `ai.admin` |
| Jobs | `POST /admin/jobs/run-scans` (manual run of expiry/stock/overdue scans) | `admin.tenant.manage` |

There are deliberately **no DELETE endpoints for regulated records**; records are cancelled, voided, rejected or corrected with a reason.

## Example: QA batch release

```http
POST /api/v1/batches/{id}/qa-release
Authorization: Bearer …
Content-Type: application/json

{ "decision": "RELEASE", "reason": "Batch record and QC results reviewed", "password": "…" }
```

Blocked release (e.g. the Scenario B dissolution OOS):

```json
{ "error": { "code": "RELEASE_BLOCKED", "message": "Batch PCM-2026-000002 is AWAITING_QC; QA decision requires AWAITING_QA",
  "details": { "reasons": [ { "code": "QC_FAILED", "message": "QC sample … concluded FAIL", "href": "/quality/samples/…" },
                            { "code": "OOS", "message": "OOS OOS-2026-0001 — Dissolution (…)", "href": "/quality/oos/…" } ] },
  "correlationId": "…" } }
```

Exact field names for every body are in Swagger; e2e tests in `apps/api/test/*.e2e-spec.ts` exercise each workflow end to end.
