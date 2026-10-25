# User Manual Generation Guide

The role manuals are generated from the **running application**. Screenshots are never drawn or mocked, and permissions are never copied by hand. Regenerate after any UI or permission change.

## Folder layout

| Path | Content |
|---|---|
| `SOURCES/modules.mjs` | Editable module content: overviews, procedures, fields, buttons, statuses, errors, general chapters (sign-in, navigation, tables, signatures, notifications, troubleshooting, mistakes, FAQ, glossary) |
| `SOURCES/roles.mjs` | Editable role content: number, title, audience, purpose, responsibilities, dependencies, worked example, escalation; deferred roles |
| `SOURCES/build-manuals.mjs` | Generator: assembles the manuals, renders PDFs, writes the catalog and inventory |
| `../../apps/web/manuals/capture.spec.ts` | Playwright screenshot capture (role tours + workflow steps) |
| `SCREENSHOTS/<role>/*.png`, `SCREENSHOTS/common/` | Genuine screenshots (clean originals, no annotation) |
| `SCREENSHOTS/manifest.json` | What was captured: file, title, caption, URL, role, sidebar per role, failures |
| `MANUAL_SOURCES/<role>_manual.md` / `.html` | Assembled editable manual sources (Markdown for review, HTML used for the PDF) |
| `PDF/NN_<Role>_User_Manual.pdf` | Final PDFs; `PDF/manifest.json` lists pages, figures and any broken images |
| `ROLE_AND_PERMISSION_CATALOG.md`, `SCREENSHOT_INVENTORY.md` | Generated catalog and inventory |

## Prerequisites

- Dev PostgreSQL running (`npm run db:start`).
- Built API and web (`npm run build`).
- Microsoft Edge installed (the default Playwright channel). To use Playwright's own Chromium instead, set `PW_CHANNEL=chromium` and install it with `npx playwright install chromium`.

## Steps

Capture screenshots. This creates a disposable database, seeds the fictional demo data, starts the API on :4101 and the web app on :3101, runs the capture, then drops the database. It takes about 30–45 minutes.

```bash
npm run manuals:capture
```

Build the manuals and PDFs:

```bash
npm run manuals:build
```

## How permissions are applied

- The permission set of each role comes from `DEFAULT_ROLES` in `packages/types`, the same definitions the API enforces.
- The sidebar table in each manual is the sidebar **actually rendered** for the demo user of that role during capture.
- A procedure appears in a manual only if the role holds one of its permission codes. Otherwise it is listed under "Not available to your role" and in chapter 16.
- Screenshots of workflow steps belong to the role that performed them. If another role may perform the same step, its manual reuses the screenshot and says which role it was captured as.

## Annotated screenshots

For key screens, the capture script also saves an **annotated copy** next to the clean original (`<name>_annotated.png`). The copy has numbered cobalt callouts and outlines; the clean original is never altered. The manual shows the annotated copy with a numbered legend under the figure. Annotated screens:

- sign-in page
- lot release blocked before QC
- batch ready for QA release
- the batch-release electronic-signature dialog

To add more, call `annotate(page, role, name, [{ loc, label }, …])` right after the screen is captured in `apps/web/manuals/capture.spec.ts`.

## Quality checks performed by the generator

- Each manual has a cover, a clickable table of contents and the same 20 chapters, which cover all 27 mandatory content items.
- Each manual has a running header and a footer with page numbers.
- Images that fail to load are reported as `brokenImages` in `PDF/manifest.json` (expected: none).
- Page counts are recorded per PDF.

## Mandatory content mapping

| Required item | Where in each manual |
|---|---|
| 1–4 Cover, product name & version, title & audience, document version & date | Cover page |
| 5 Table of contents | Contents page (clickable) |
| 6 Purpose and scope | Ch. 1 |
| 7 Role responsibilities | Ch. 2 |
| 8 Login and logout | Ch. 3 |
| 9 Dashboard overview | Ch. 4 |
| 10 Navigation and module overview | Ch. 5 |
| 11–12 Accessible features, step-by-step instructions | Ch. 6 |
| 13–14 Field explanations, inputs and validation | Ch. 7 |
| 15 Buttons | Ch. 8 |
| 16 Workflow and approval steps | Ch. 9 |
| 17 Status meanings | Ch. 10 |
| 18 Search, filters, sorting, pagination | Ch. 11 |
| 19 Reports and exports | Ch. 12 |
| 20 Notifications and alerts | Ch. 13 |
| 21 Error messages and troubleshooting | Ch. 14 |
| 22 Common mistakes | Ch. 15 |
| 23 Security and access limitations | Ch. 16 |
| 24 End-to-end example | Ch. 17 |
| 25 FAQ | Ch. 18 |
| 26 Glossary | Ch. 19 |
| 27 Escalation | Ch. 20 (configured roles only; no invented contacts) |

## Editing tips

- Use labels exactly as they appear in the UI. Check them in the screenshots or in `apps/web/app/**/page.tsx`.
- To add a screen, add an entry to `SCREENS` (tour) or a step in Phase B (workflow) of `capture.spec.ts`, reference its `name` in `modules.mjs`, then capture and build again.
- Never describe deferred features as working. Mark them as not available in this release.
