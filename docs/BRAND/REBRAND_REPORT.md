# Rebrand Report: Pharma360 → Pharmodry

**Dates:** 2026-10-24 to 2026-10-25
**Brand line:** *Precision in Every Batch.*
**Brand guidelines:** [BRAND_GUIDELINES.md](BRAND_GUIDELINES.md)

## 1. What changed

| Area | Change |
|---|---|
| Identity | New logo (capsule-bowl "P" with a precision dot) in light, dark, mono and reverse variants, plus a horizontal lockup with the brand line. Navy/Cobalt/Cyan palette; Inter typography. Assets are in `docs/BRAND/logo/`. |
| Web UI | Theme tokens (light and dark) in `apps/web/app/globals.css`; `brand.*` Tailwind colours; new `Logo`/`LogoMark` component (cobalt badge in dark mode); login brand panel (navy, cobalt/cyan glow, brand line); favicon, PNG icons, Apple touch icon and page-title metadata (`Pharmodry`); sidebar footer. Status colours and the validated chart palette are unchanged. |
| Product name | "Pharma360" → "Pharmodry" in all UI text, API messages, AI system prompts, Swagger title, seed console output, notifications, scripts and comments (about 100 source and configuration files). |
| Code identifiers | npm scope `@pharma360/*` → `@pharmodry/*` (workspaces relinked); root package `pharmodry`; JWT issuer `pharmodry`; test databases `pmd_e2e_*` / `pmd_ui_*`; Docker user and images `pharmodry`, `pharmodry-api`, `pharmodry-web`; Compose project and new-install database defaults `pharmodry`; localStorage keys `pmd.*`. |
| Database | Migration `20261024090000_pharmodry_rebrand` renames the append-only guard function to `pharmodry_reject_mutation`. Triggers reference it by OID, so immutability is unaffected. This was verified: a DELETE on `audit_events` is still rejected after the rename. **No records were changed by the migration.** |
| Demo credential | The development default `SEED_DEMO_PASSWORD` changed to `Pharmodry!Demo26`. The brand-only `Pharmodry!Demo` was rejected because the password policy requires a digit. In the existing demo database, all 22 fictional demo accounts were rotated through the audited admin endpoint `POST /users/:id/reset-password`, so each change is in the audit trail and their sessions were revoked. |
| Documentation | 21 hand-written documents updated (README, architecture, API, database, security, AI, deployment, validation, research, audit, demo, manual sources). New: `docs/BRAND/BRAND_GUIDELINES.md` and this report. |
| User manuals | The generator uses the brand palette, the logo lockup on the cover, a Navy → Cobalt → Cyan cover band, and the mark plus brand line in every page header. All screenshots were re-captured from the rebranded application and all PDFs regenerated. |

## 2. Backward compatibility (no regressions for existing sessions or clients)

| Interface | New | Still accepted | Test |
|---|---|---|---|
| Refresh-token cookie | `pmd_rt` | `p360_rt` (read once, then cleared) | `security.e2e-spec.ts` "rebrand compatibility: pmd_rt cookie…" |
| Anti-CSRF header `X-Requested-With` | `pharmodry` | `pharma360` (any other value → 401) | same test |
| JWT issuer | `pharmodry` | `pharma360` (other issuers → 401) | "access tokens from the old issuer stay valid…" |
| Saved table filters / columns | `pmd.*` keys | `p360.*` keys read as fallback | — (browser storage) |

## 3. Deliberately retained identifiers (data preservation)

These still contain the old name. Changing them would require renaming databases, roles or applied migrations, which would put existing data at risk:

| Identifier | Where | Reason |
|---|---|---|
| Database role `pharma360` / password `pharma360_dev`, databases `pharma360_demo`, `pharma360_dev`, `pharma360_e2e`, `pharma360`, `pharma360_test` | `apps/api/.env`, `apps/api/.env.example`, `infrastructure/dev-postgres.mjs`, `infrastructure/test-env.mjs`, `docs/DATABASE.md` | Existing local cluster and its data. Renaming needs an explicit, owner-approved database migration. New installs (Compose, root `.env.example`) already default to `pharmodry`. |
| `pharma360_reject_mutation` | Migration `20261017071600_compliance_controls` | Applied migrations are checksummed by Prisma and must not be edited. The function is renamed by the new migration. |
| `p360_rt`, `pharma360` literals | `auth.controller.ts`, `core.module.ts`, `security.e2e-spec.ts`, `data-table.tsx` (`p360.*` fallback keys) | Compatibility constants (section 2) and the tests that prove them. |
| Existing scratch database names (`p360_shadow`, `p360_e2e_…`, `p360_ui_…`) | `docs/AUDIT/UNRESOLVED_DEFECTS.md` U-13 | They are the literal names of databases on disk. |
| Historical audit events and AI messages whose stored text says "Pharma360" | Database | The audit trail is immutable by design and must not be rewritten. |

## 4. Verification

See section 5 of [`docs/AUDIT/FINAL_TEST_REPORT.md`](../AUDIT/FINAL_TEST_REPORT.md) for the post-rebrand test run. The residual-brand scan command is:

```bash
grep -rIil "pharma360" --exclude-dir={node_modules,.next,dist,.data,.git,migrations} .
```

It is expected to list only the files in section 3.
