/**
 * Genuine screenshot capture for the role-based user manuals.
 *
 * Phase A — for every implemented role: log in through the real login form, record the sidebar the role
 * actually sees, and screenshot each screen the role is permitted to open (lists, detail pages, forms).
 * Phase B — perform a complete receipt-to-release workflow (and PO, deviation, CAPA, OOS, copilot) as the
 * responsible roles, capturing real forms, blocked states and electronic-signature dialogs.
 *
 * Runs against a freshly seeded, disposable database (npm run manuals:capture). Failures are recorded in the
 * manifest rather than hidden, so the manuals never reference a screenshot that does not exist.
 */
import { Browser, expect, Locator, Page, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_ROLES } from '@pharmodry/types';
import { PASSWORD, STEP_VALUES, submitDialog } from '../e2e/helpers';

const OUT = resolve(__dirname, '../../../docs/USER_MANUALS/SCREENSHOTS');

export const ROLES = [
  { slug: 'super_admin', code: 'SUPER_ADMIN', email: 'super.admin@novacure.demo' },
  { slug: 'company_admin', code: 'COMPANY_ADMIN', email: 'company.admin@novacure.demo' },
  { slug: 'plant_manager', code: 'PLANT_MANAGER', email: 'plant.manager@novacure.demo' },
  { slug: 'production_manager', code: 'PRODUCTION_MANAGER', email: 'production.manager@novacure.demo' },
  { slug: 'production_supervisor', code: 'PRODUCTION_SUPERVISOR', email: 'production.supervisor@novacure.demo' },
  { slug: 'production_operator', code: 'PRODUCTION_OPERATOR', email: 'operator@novacure.demo' },
  { slug: 'qa_manager', code: 'QA_MANAGER', email: 'qa.manager@novacure.demo' },
  { slug: 'qa_officer', code: 'QA_OFFICER', email: 'qa.officer@novacure.demo' },
  { slug: 'qc_manager', code: 'QC_MANAGER', email: 'qc.manager@novacure.demo' },
  { slug: 'qc_analyst', code: 'QC_ANALYST', email: 'qc.analyst@novacure.demo' },
  { slug: 'warehouse_manager', code: 'WAREHOUSE_MANAGER', email: 'warehouse.manager@novacure.demo' },
  { slug: 'warehouse_officer', code: 'WAREHOUSE_OFFICER', email: 'warehouse.officer@novacure.demo' },
  { slug: 'procurement_manager', code: 'PROCUREMENT_MANAGER', email: 'procurement.manager@novacure.demo' },
  { slug: 'procurement_officer', code: 'PROCUREMENT_OFFICER', email: 'procurement.officer@novacure.demo' },
  { slug: 'supply_chain_planner', code: 'SUPPLY_CHAIN_PLANNER', email: 'planner@novacure.demo' },
  { slug: 'engineering', code: 'ENGINEERING', email: 'engineering@novacure.demo' },
  { slug: 'regulatory_affairs', code: 'REGULATORY_AFFAIRS', email: 'regulatory@novacure.demo' },
  { slug: 'auditor', code: 'AUDITOR', email: 'auditor@novacure.demo' },
  { slug: 'management_viewer', code: 'MANAGEMENT_VIEWER', email: 'management@novacure.demo' },
] as const;

type Ids = Record<string, string | undefined>;
interface Screen {
  name: string;
  title: string;
  caption: string;
  url: (ids: Ids) => string | undefined;
  any: string[];
  all?: string[];
  prepare?: (p: Page) => Promise<void>;
  fullPage?: boolean;
}

const tab = (name: RegExp | string) => async (p: Page) => {
  await p.getByRole('tab', { name }).first().click({ timeout: 10_000 });
  await p.waitForTimeout(600);
};

/** Screens visited in Phase A (only when the role holds at least one of `any`). */
const SCREENS: Screen[] = [
  { name: 'my_work', title: 'My work (home)', caption: 'Home page with the work queues available to this role.', url: () => '/', any: [] },
  { name: 'command_center', title: 'Command Center', caption: 'Exception-driven Command Center: what needs attention, why, owner and age.', url: () => '/command-center', any: ['commandcenter.view'] },
  { name: 'dashboard', title: 'Management dashboard', caption: 'KPI cards and charts computed from live records; click a KPI to drill down.', url: () => '/dashboard', any: ['analytics.view'] },
  { name: 'copilot', title: 'Copilot', caption: 'Copilot question box. Answers are computed by Pharmodry; the AI only explains them.', url: () => '/copilot', any: ['ai.copilot.use'] },
  { name: 'po_list', title: 'Purchase orders', caption: 'Purchase order list with status, supplier and value.', url: () => '/procurement/purchase-orders', any: ['procurement.po.view'] },
  { name: 'po_detail', title: 'Purchase order detail', caption: 'Purchase order detail with lines, approval and audit trail.', url: (i) => i.po && `/procurement/purchase-orders/${i.po}`, any: ['procurement.po.view'] },
  { name: 'grn_list', title: 'Goods receipts', caption: 'Goods receipts (GRN). Every line creates a lot in QUARANTINE.', url: () => '/inventory/receipts', any: ['inventory.view'] },
  { name: 'grn_detail', title: 'Goods receipt detail', caption: 'Received lots and their status after a goods receipt.', url: (i) => i.grn && `/inventory/receipts/${i.grn}`, any: ['inventory.view'] },
  { name: 'inventory_list', title: 'Inventory', caption: 'Lot-level inventory with status, location and expiry filters.', url: () => '/inventory', any: ['inventory.view'] },
  { name: 'inventory_risk', title: 'Stock-out risk', caption: 'Stock-out risk by material (released stock vs planned demand and lead time).', url: () => '/inventory', any: ['inventory.view'], prepare: tab('Stock-out risk') },
  { name: 'inventory_expiry', title: 'Expiry intelligence', caption: 'Expiry intelligence buckets with recommended actions.', url: () => '/inventory', any: ['inventory.view'], prepare: tab('Expiry intelligence') },
  { name: 'lot_quarantine', title: 'Lot in quarantine', caption: 'A quarantined lot: release is blocked until QC approval; blockers are listed.', url: (i) => i.quarantineLot && `/inventory/lots/${i.quarantineLot}`, any: ['inventory.view'] },
  { name: 'lot_released', title: 'Released lot', caption: 'A released material lot with available quantity, location and expiry.', url: (i) => i.releasedLot && `/inventory/lots/${i.releasedLot}`, any: ['inventory.view'] },
  { name: 'movements', title: 'Stock movements', caption: 'Append-only inventory ledger of every movement.', url: () => '/inventory/movements', any: ['inventory.view'] },
  { name: 'plan_list', title: 'Production plans', caption: 'Production plans with achievement against released output.', url: () => '/production/plans', any: ['production.plan.view'] },
  { name: 'plan_detail', title: 'Production plan detail', caption: 'Plan lines with material feasibility and batch creation.', url: (i) => i.plan && `/production/plans/${i.plan}`, any: ['production.plan.view'] },
  { name: 'batch_list', title: 'Batches & eBMR', caption: 'Batch list with lifecycle status, yield and QA decision.', url: () => '/production/batches', any: ['batch.view'] },
  { name: 'batch_released', title: 'Released batch — overview', caption: 'Overview of a released batch: yield, finished goods, GS1 data and QA decision.', url: (i) => i.releasedBatch && `/production/batches/${i.releasedBatch}`, any: ['batch.view'], fullPage: true },
  { name: 'batch_ebmr_progress', title: 'Batch in progress — eBMR', caption: 'Electronic batch record of a batch in progress: steps, parameters, signatures.', url: (i) => i.progressBatch && `/production/batches/${i.progressBatch}`, any: ['batch.view'], prepare: tab('Manufacturing (eBMR)') },
  { name: 'batch_blocked', title: 'Batch blocked by OOS', caption: 'A batch whose release is blocked: failed QC and an open OOS investigation.', url: (i) => i.oosBatch && `/production/batches/${i.oosBatch}`, any: ['batch.view'] },
  { name: 'batch_shortage', title: 'Batch with material shortage', caption: 'A planned batch that cannot reserve materials because released stock is insufficient.', url: (i) => i.shortageBatch && `/production/batches/${i.shortageBatch}`, any: ['batch.view'], prepare: tab('Materials') },
  { name: 'batch_record', title: 'Printable batch record', caption: 'Print-ready batch manufacturing record (use the browser’s Save as PDF).', url: (i) => i.releasedBatch && `/production/batches/${i.releasedBatch}/record`, any: ['batch.view'] },
  { name: 'traceability', title: 'Traceability & mock recall', caption: 'Mock recall reconciliation of a released batch.', url: (i) => i.releasedBatch && `/traceability?batch=${i.releasedBatch}`, any: ['batch.view'], all: ['batch.view', 'inventory.view'] },
  { name: 'traceability_backward', title: 'Backward genealogy', caption: 'Input material lots with supplier, GRN and QC release evidence.', url: (i) => i.releasedBatch && `/traceability?batch=${i.releasedBatch}`, any: ['batch.view'], all: ['batch.view', 'inventory.view'], prepare: tab(/Backward genealogy/) },
  { name: 'qa_release_queue', title: 'QA release queue', caption: 'Batches and material lots awaiting QC/QA disposition.', url: () => '/quality/release', any: ['inventory.release', 'batch.approve'] },
  { name: 'sample_list', title: 'QC samples', caption: 'QC sample list by status and stage.', url: () => '/quality/samples', any: ['qc.view'] },
  { name: 'sample_detail', title: 'QC sample detail', caption: 'A QC sample awaiting collection, with specification tests.', url: (i) => i.sample && `/quality/samples/${i.sample}`, any: ['qc.view'] },
  { name: 'oos_list', title: 'OOS investigations', caption: 'Out-of-specification investigations with phase and owner.', url: () => '/quality/oos', any: ['oos.view'] },
  { name: 'oos_detail', title: 'OOS investigation detail', caption: 'OOS investigation with phase stepper, linked records and QA conclusion area.', url: (i) => i.oos && `/quality/oos/${i.oos}`, any: ['oos.view'] },
  { name: 'deviation_list', title: 'Deviations', caption: 'Deviation register with classification, aging and owner.', url: () => '/quality/deviations', any: ['deviation.view'] },
  { name: 'deviation_detail', title: 'Deviation detail', caption: 'Deviation record with workflow actions, RCA, CAPAs and evidence.', url: (i) => i.deviation && `/quality/deviations/${i.deviation}`, any: ['deviation.view'] },
  { name: 'capa_list', title: 'CAPA', caption: 'CAPA register with priority, owner and due date.', url: () => '/quality/capa', any: ['capa.view'] },
  { name: 'capa_detail', title: 'CAPA detail', caption: 'CAPA with actions, effectiveness check and closure.', url: (i) => i.capa && `/quality/capa/${i.capa}`, any: ['capa.view'] },
  { name: 'pqr', title: 'Product Quality Review', caption: 'Product Quality Review data pack for a product and period.', url: () => '/quality/pqr', any: ['analytics.view'], all: ['analytics.view', 'batch.view'] },
  { name: 'products', title: 'Products', caption: 'Product master list with GTIN and registration.', url: () => '/master-data/products', any: ['masterdata.view'] },
  { name: 'product_detail', title: 'Product detail', caption: 'Product detail: BOM, manufacturing template, specifications and versions.', url: (i) => i.product && `/master-data/products/${i.product}`, any: ['masterdata.view'] },
  { name: 'materials', title: 'Materials', caption: 'Material master with released and quarantined stock.', url: () => '/master-data/materials', any: ['masterdata.view'] },
  { name: 'material_detail', title: 'Material detail', caption: 'Material detail: lots in FEFO order, approved suppliers, specifications.', url: (i) => i.material && `/master-data/materials/${i.material}`, any: ['masterdata.view'] },
  { name: 'suppliers', title: 'Suppliers', caption: 'Supplier list with qualification status and scorecards.', url: () => '/master-data/suppliers', any: ['supplier.view'] },
  { name: 'supplier_detail', title: 'Supplier detail', caption: 'Supplier qualification, approved materials, certifications and receipts.', url: (i) => i.supplier && `/master-data/suppliers/${i.supplier}`, any: ['supplier.view'] },
  { name: 'equipment', title: 'Equipment & calibration', caption: 'Equipment list with calibration status.', url: () => '/master-data/equipment', any: ['masterdata.view'] },
  { name: 'equipment_detail', title: 'Equipment detail', caption: 'Equipment detail with calibration history.', url: (i) => i.equipment && `/master-data/equipment/${i.equipment}`, any: ['masterdata.view'] },
  { name: 'specifications', title: 'QC specifications', caption: 'Versioned QC specifications.', url: () => '/master-data/specifications', any: ['masterdata.view'] },
  { name: 'specification_detail', title: 'Specification detail', caption: 'Specification tests and acceptance criteria.', url: (i) => i.spec && `/master-data/specifications/${i.spec}`, any: ['masterdata.view'] },
  { name: 'audit_trail', title: 'Audit trail', caption: 'Central audit trail with hash-chain verification.', url: () => '/audit-trail', any: ['audit.view'] },
  { name: 'reports', title: 'Reports', caption: 'Report and export catalogue.', url: () => '/reports', any: ['report.export', 'audit.export'] },
  { name: 'notifications', title: 'Notifications', caption: 'Notification inbox and preferences.', url: () => '/notifications', any: [] },
  { name: 'profile', title: 'Profile & security', caption: 'Profile: password change and active sessions.', url: () => '/profile', any: [] },
  { name: 'admin_users', title: 'Users', caption: 'User administration with roles and site scope.', url: () => '/admin/users', any: ['admin.user.manage'] },
  { name: 'admin_roles', title: 'Roles & permissions', caption: 'Role and permission matrix (changes require a reason).', url: () => '/admin/roles', any: ['admin.role.manage'] },
  { name: 'admin_organization', title: 'Organisation & policies', caption: 'Organisation, sites, warehouses and configurable policies.', url: () => '/admin/organization', any: ['admin.site.manage', 'admin.tenant.manage'] },
  { name: 'admin_ai', title: 'AI governance', caption: 'AI usage, provider status and feedback.', url: () => '/admin/ai', any: ['ai.admin'] },
];

interface Shot { role: string; name: string; file: string; title: string; caption: string; url: string; phase: 'tour' | 'workflow'; annotated?: string; legend?: string[] }
const manifest: { generatedAt: string; baseURL: string; viewport: string; roles: Record<string, { email: string; code: string; nav: { group: string; label: string; href: string }[]; screens: string[] }>; shots: Shot[]; failures: { role: string; name: string; error: string }[] } = {
  generatedAt: new Date().toISOString(),
  baseURL: '',
  viewport: '1366×860 @1.5x, light theme',
  roles: {},
  shots: [],
  failures: [],
};

async function settle(p: Page, extra = 500) {
  await p.waitForLoadState('networkidle').catch(() => undefined);
  await p.waitForTimeout(extra);
}

async function shot(p: Page, role: string, name: string, title: string, caption: string, opts: { fullPage?: boolean; dialog?: boolean; phase?: 'tour' | 'workflow' } = {}) {
  mkdirSync(resolve(OUT, role), { recursive: true });
  const file = `${role}/${name}.png`;
  if (opts.dialog) await p.getByRole('dialog').screenshot({ path: resolve(OUT, file) });
  else await p.screenshot({ path: resolve(OUT, file), fullPage: !!opts.fullPage });
  manifest.shots.push({ role, name, file, title, caption, url: new URL(p.url()).pathname + new URL(p.url()).search, phase: opts.phase ?? 'tour' });
}

/**
 * Separate annotated copy of the most recent screenshot `name`: numbered cobalt callouts and outlines on the
 * given elements. The clean original is kept; the manual shows the annotated copy with a numbered legend.
 */
async function annotate(p: Page, role: string, name: string, items: { loc: Locator; label: string }[], opts: { dialog?: boolean } = {}) {
  const boxes: { x: number; y: number; width: number; height: number }[] = [];
  const legend: string[] = [];
  for (const it of items) {
    const b = await it.loc.first().boundingBox();
    if (b) {
      boxes.push(b);
      legend.push(it.label);
    }
  }
  await p.evaluate((bs) => {
    bs.forEach((b, i) => {
      const ring = document.createElement('div');
      const badge = document.createElement('div');
      ring.className = badge.className = '__pmd_ann';
      Object.assign(ring.style, { position: 'fixed', left: `${b.x - 4}px`, top: `${b.y - 4}px`, width: `${b.width + 8}px`, height: `${b.height + 8}px`, border: '2.5px solid #1F4FCC', borderRadius: '8px', zIndex: '2147483646', pointerEvents: 'none' });
      Object.assign(badge.style, { position: 'fixed', left: `${Math.max(2, b.x - 16)}px`, top: `${Math.max(2, b.y - 16)}px`, width: '26px', height: '26px', borderRadius: '50%', background: '#1F4FCC', color: '#fff', font: "700 14px Inter, 'Segoe UI', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 3px #fff', zIndex: '2147483647', pointerEvents: 'none' });
      badge.textContent = String(i + 1);
      document.body.append(ring, badge);
    });
  }, boxes);
  const file = `${role}/${name}_annotated.png`;
  if (opts.dialog) {
    const d = (await p.getByRole('dialog').boundingBox())!;
    await p.screenshot({ path: resolve(OUT, file), clip: { x: Math.max(0, d.x - 20), y: Math.max(0, d.y - 20), width: d.width + 40, height: d.height + 40 } });
  } else await p.screenshot({ path: resolve(OUT, file) });
  await p.evaluate(() => document.querySelectorAll('.__pmd_ann').forEach((e) => e.remove()));
  const target = [...manifest.shots].reverse().find((x) => x.role === role && x.name === name);
  if (target) {
    target.annotated = file;
    target.legend = legend;
  }
}

async function login(browser: Browser, email: string) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto('/login');
  await p.getByLabel('Email').fill(email);
  await p.getByLabel('Password').fill(PASSWORD);
  await p.getByRole('button', { name: 'Sign in' }).click();
  await expect(p.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
  await settle(p);
  return p;
}

const slugOf = (email: string) => ROLES.find((r) => r.email === email)!.slug;

/** Record ids resolved once by capture.setup.ts. */
async function resolveIds(): Promise<Ids> {
  return JSON.parse(readFileSync(resolve(OUT, '_parts', 'ids.json'), 'utf8')) as Ids;
}

const resetManifest = (baseURL?: string) => {
  manifest.baseURL = baseURL ?? '';
  manifest.roles = {};
  manifest.shots = [];
  manifest.failures = [];
};
/** Each test writes its own fragment; the manual builder merges them into manifest.json. */
const writePart = (name: string) => {
  mkdirSync(resolve(OUT, '_parts'), { recursive: true });
  writeFileSync(resolve(OUT, '_parts', `${name}.json`), JSON.stringify(manifest, null, 2));
};

test.describe.configure({ mode: 'parallel' });

test('common: sign-in page', async ({ browser, baseURL }) => {
  resetManifest(baseURL);
  mkdirSync(resolve(OUT, 'common'), { recursive: true });
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto('/login');
  await settle(p);
  await shot(p, 'common', 'login', 'Sign-in page', 'Sign-in page. Enter your company e-mail and password, then select Sign in.');
  await annotate(p, 'common', 'login', [
    { loc: p.getByLabel('Email'), label: 'Company e-mail address' },
    { loc: p.getByLabel('Password'), label: 'Password (also your e-signature credential)' },
    { loc: p.getByRole('button', { name: 'Sign in' }), label: 'Sign in' },
  ]);
  await ctx.close();
  writePart('common');
});

// ---------- Phase A: one tour test per role ----------
for (const r of ROLES) {
  test(`tour: ${r.slug}`, async ({ browser, baseURL }) => {
    resetManifest(baseURL);
    const ids = await resolveIds();
    const perms = new Set(DEFAULT_ROLES.find((d) => d.code === r.code)!.permissions as string[]);
    const p = await login(browser, r.email);
    const nav = await p.locator('nav[aria-label="Main navigation"]').evaluate((navEl) => {
      const out: { group: string; label: string; href: string }[] = [];
      let group = '';
      navEl.querySelectorAll('*').forEach((el) => {
        if (el.tagName === 'A') out.push({ group, label: (el.textContent ?? '').trim(), href: el.getAttribute('href') ?? '' });
        else if (el.children.length === 0 && /uppercase/.test((el as HTMLElement).className) && el.textContent) group = el.textContent.trim();
      });
      return out.filter((x) => x.href.startsWith('/') && x.label && x.group);
    });
    manifest.roles[r.slug] = { email: r.email, code: r.code, nav, screens: [] };
    let apiErrors: string[] = [];
    p.on('response', (res) => {
      if (res.url().includes('/api/v1/') && (res.status() === 403 || res.status() >= 500)) apiErrors.push(`${res.status()} ${new URL(res.url()).pathname}`);
    });
    for (const s of SCREENS) {
      if (s.any.length && !s.any.some((x) => perms.has(x))) continue;
      if (s.all && !s.all.every((x) => perms.has(x))) continue;
      const url = s.url(ids);
      if (!url) continue;
      // Up to three attempts: under parallel load a page may still be rendering when a tab is clicked.
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          apiErrors = [];
          await p.goto(url);
          await settle(p, s.name === 'dashboard' || s.name === 'command_center' ? 1500 : 350 * attempt);
          if (s.prepare) await s.prepare(p);
          await shot(p, r.slug, s.name, s.title, s.caption, { fullPage: s.fullPage });
          manifest.roles[r.slug].screens.push(s.name);
          if (apiErrors.length) manifest.failures.push({ role: r.slug, name: s.name, error: `API errors while rendering: ${[...new Set(apiErrors)].join(', ')}` });
          break;
        } catch (e) {
          if (attempt === 3) manifest.failures.push({ role: r.slug, name: s.name, error: (e as Error).message.split('\n')[0] });
        }
      }
    }
    // Operator: the step-start dialog on the in-progress batch (opened and cancelled, nothing saved)
    if (r.code === 'PRODUCTION_OPERATOR' && ids.progressBatch) {
      try {
        await p.goto(`/production/batches/${ids.progressBatch}`);
        await settle(p);
        await tab('Manufacturing (eBMR)')(p);
        const start = p.locator('[data-testid^="start-"]:not([disabled])').first();
        await start.click();
        await expect(p.getByRole('dialog')).toBeVisible();
        await shot(p, r.slug, 'ebmr_start_dialog', 'Start an eBMR step', 'Starting a step: select qualified, calibrated equipment.', { dialog: true });
        await p.keyboard.press('Escape');
      } catch (e) {
        manifest.failures.push({ role: r.slug, name: 'ebmr_start_dialog', error: (e as Error).message.split('\n')[0] });
      }
    }
    await p.context().close();
    writePart(`tour_${r.slug}`);
  });
}

// ---------- Phase B: workflow captures (mutates the disposable database) ----------
test('workflow: receipt to release and quality events', async ({ browser, baseURL }) => {
  resetManifest(baseURL);
  const ids = await resolveIds();
  const W = async (email: string, name: string, title: string, caption: string, p: Page, opts: { dialog?: boolean; fullPage?: boolean } = {}) => {
    try {
      await settle(p, 400);
      await shot(p, slugOf(email), name, title, caption, { ...opts, phase: 'workflow' });
      writePart('workflow'); // keep progress even if a later step fails
    } catch (e) {
      manifest.failures.push({ role: slugOf(email), name, error: (e as Error).message.split('\n')[0] });
    }
  };
  const signDialog = async (p: Page, reason?: string) => {
    const d = p.getByRole('dialog');
    await expect(d.getByText('Electronic signature')).toBeVisible();
    if (reason) await d.getByLabel(/Reason|Justification|comment/i).first().fill(reason);
    await d.getByLabel(/Re-enter your password/).fill(PASSWORD);
  };
  const confirmSign = async (p: Page) => {
    const d = p.getByRole('dialog');
    await d.getByTestId('sign-submit').click();
    await expect(d).toBeHidden({ timeout: 30_000 });
  };

  // B1 Procurement: create and approve a purchase order
  const PO_OFF = 'procurement.officer@novacure.demo';
  const PO_MGR = 'procurement.manager@novacure.demo';
  let poUrl = '';
  {
    const p = await login(browser, PO_OFF);
    await p.goto('/procurement/purchase-orders/new');
    await settle(p);
    await p.getByLabel('Supplier').selectOption({ label: 'Lahore Excipients (Pvt) Ltd (demo) (approved)' });
    await p.getByLabel('Material').first().selectOption({ label: 'EXC-MCC-101 — Microcrystalline Cellulose PH-101' });
    await p.getByLabel('Quantity').first().fill('500');
    await p.getByLabel('Unit price (PKR)').first().fill('950');
    await W(PO_OFF, 'wf_po_create_form', 'Create a purchase order', 'New purchase order: approved supplier, approved material, quantity and price.', p, { fullPage: true });
    await p.getByRole('button', { name: 'Create purchase order' }).click();
    await p.waitForURL(/purchase-orders\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    poUrl = p.url();
    await W(PO_OFF, 'wf_po_draft', 'Purchase order in draft', 'The new order is a draft until a different user approves it.', p);
    await p.context().close();
    const m = await login(browser, PO_MGR);
    await m.goto(poUrl);
    await W(PO_MGR, 'wf_po_awaiting_approval', 'Approve a purchase order', 'Draft order awaiting approval by the procurement manager.', m);
    await m.getByRole('button', { name: 'Approve' }).click();
    await settle(m, 800);
    await W(PO_MGR, 'wf_po_approved', 'Approved purchase order', 'Approved order, ready for goods receipt.', m);
    await m.context().close();
  }

  // B2 Warehouse: goods receipt → quarantine
  const WH = 'warehouse.officer@novacure.demo';
  let lotUrl = '';
  let sampleUrl = '';
  {
    const p = await login(browser, WH);
    await p.goto('/inventory/receipts/new');
    await settle(p);
    await p.getByTestId('grn-supplier').selectOption({ label: 'Lahore Excipients (Pvt) Ltd (demo) (approved)' });
    await p.getByTestId('grn-add-line').click();
    const line = p.getByTestId('grn-line-0');
    await line.getByLabel('Material').selectOption({ label: 'EXC-MCC-101 — Microcrystalline Cellulose PH-101' });
    await line.getByLabel('Supplier batch').fill('LE-MCC-26-0912');
    await line.getByLabel(/^Quantity/).fill('120');
    await line.getByLabel('Mfg date').fill('2026-09-01');
    await line.getByLabel('Expiry date').fill('2029-08-31');
    await W(WH, 'wf_grn_create_form', 'Create a goods receipt', 'Goods receipt form: supplier, delivery note and one line per supplier batch.', p, { fullPage: true });
    await p.getByTestId('grn-submit').click();
    await p.waitForURL(/receipts\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(p.locator('[data-status="QUARANTINE"]').first()).toBeVisible();
    await W(WH, 'wf_grn_created', 'Goods receipt created', 'Receipt created: the lot is in QUARANTINE and a QC sample was requested automatically.', p);
    lotUrl = new URL((await p.getByRole('link', { name: /^EX\d/ }).first().getAttribute('href'))!, p.url()).pathname;
    sampleUrl = new URL((await p.getByRole('link', { name: /QCS-/ }).first().getAttribute('href'))!, p.url()).pathname;
    await p.context().close();
  }

  // B3 QA officer sees release blocked
  const QAO = 'qa.officer@novacure.demo';
  {
    const p = await login(browser, QAO);
    await p.goto(lotUrl);
    await W(QAO, 'wf_lot_release_blocked', 'Lot release blocked before QC', 'Release is disabled; the blockers explain what is missing (QC approval).', p);
    await annotate(p, slugOf(QAO), 'wf_lot_release_blocked', [
      { loc: p.locator('[data-status]').first(), label: 'Lot status (QUARANTINE)' },
      { loc: p.getByText('This lot cannot be released yet'), label: 'Release blockers, with links to the missing step' },
      { loc: p.getByTestId('lot-release'), label: 'QA release — disabled until every blocker is cleared' },
    ]);
    await p.context().close();
  }

  // B4 QC analyst: collect, enter results, submit
  const QCA = 'qc.analyst@novacure.demo';
  {
    const p = await login(browser, QCA);
    await p.goto(sampleUrl);
    await W(QCA, 'wf_sample_requested', 'QC sample requested', 'A requested sample with the specification tests to perform.', p);
    await p.getByTestId('sample-collect').click();
    await expect(p.getByRole('dialog')).toBeVisible();
    await W(QCA, 'wf_sample_collect_dialog', 'Record sample collection', 'Recording sample collection (quantity withdrawn is deducted from the lot).', p, { dialog: true });
    await submitDialog(p);
    await p.getByTestId('test-row-Identification').getByLabel('Identification result').selectOption('true');
    await p.getByTestId('test-row-Loss on drying').getByLabel('Loss on drying result').fill('4.1');
    await W(QCA, 'wf_sample_results_entry', 'Enter QC results', 'Result entry: each value is evaluated against the specification snapshot.', p, { fullPage: true });
    await p.getByTestId('save-results').click();
    await expect(p.getByText('Results recorded')).toBeVisible();
    await p.getByTestId('sample-submit').click();
    await expect(p.locator('[data-status="SUBMITTED"]').first()).toBeVisible();
    await W(QCA, 'wf_sample_submitted', 'Results submitted', 'Submitted results awaiting review by a different person.', p);
    await p.context().close();
  }

  // B5 QC manager: review and approve (e-signature)
  const QCM = 'qc.manager@novacure.demo';
  {
    const p = await login(browser, QCM);
    await p.goto(sampleUrl);
    await p.getByTestId('sample-review').click();
    await settle(p, 800);
    await W(QCM, 'wf_sample_reviewed', 'Sample reviewed', 'Reviewed sample ready for approval.', p);
    await p.getByTestId('sample-approve').click();
    await signDialog(p);
    await W(QCM, 'wf_sample_approve_signature', 'Approve with electronic signature', 'Approval requires password re-entry; the signature meaning is recorded.', p, { dialog: true });
    await confirmSign(p);
    await expect(p.locator('[data-status="APPROVED"]').first()).toBeVisible();
    await W(QCM, 'wf_sample_approved', 'Sample approved', 'Approved sample with PASS conclusion.', p);
    await p.context().close();
  }

  // B6 QA officer: release the lot (e-signature)
  {
    const p = await login(browser, QAO);
    await p.goto(lotUrl);
    await expect(p.getByText('Ready for QA disposition')).toBeVisible();
    await W(QAO, 'wf_lot_ready', 'Lot ready for QA disposition', 'QC approved: the lot can now be released or rejected by QA.', p);
    await p.getByTestId('lot-release').click();
    await signDialog(p);
    await W(QAO, 'wf_lot_release_signature', 'Release a lot with e-signature', 'QA disposition requires an electronic signature.', p, { dialog: true });
    await confirmSign(p);
    await expect(p.locator('[data-status="RELEASED"]').first()).toBeVisible();
    await W(QAO, 'wf_lot_released', 'Lot released', 'The lot is RELEASED and can be reserved by production (FEFO).', p);
    await p.context().close();
  }

  // B7 Planner: create batch and reserve
  const PL = 'planner@novacure.demo';
  let batchUrl = '';
  {
    const p = await login(browser, PL);
    await p.goto('/production/batches/new');
    await settle(p);
    await p.getByTestId('batch-product').selectOption({ label: 'PCM-500 — Paracetamol 500 mg' });
    await expect(p.getByText('All materials available')).toBeVisible();
    await W(PL, 'wf_batch_create_form', 'Create a batch', 'New batch form with live material availability (released stock only).', p, { fullPage: true });
    await p.getByTestId('batch-submit').click();
    await p.waitForURL(/batches\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    batchUrl = p.url();
    await W(PL, 'wf_batch_planned', 'Batch planned', 'A planned batch; the next step is FEFO material reservation.', p);
    await p.getByTestId('batch-reserve').click();
    await expect(p.locator('[data-status="MATERIAL_RESERVED"]').first()).toBeVisible();
    await tab('Materials')(p);
    await W(PL, 'wf_batch_reserved', 'Materials reserved (FEFO)', 'Reserved lots in first-expiry-first-out order.', p);
    await p.context().close();
  }

  // B8 Warehouse: issue materials
  {
    const p = await login(browser, WH);
    await p.goto(batchUrl);
    await W(WH, 'wf_batch_issue', 'Issue materials to a batch', 'Issuing reserved materials to production.', p);
    await p.getByTestId('batch-issue').click();
    await expect(p.locator('[data-status="READY"]').first()).toBeVisible();
    await p.context().close();
  }

  // B9 Supervisor: start
  const SUP = 'production.supervisor@novacure.demo';
  {
    const p = await login(browser, SUP);
    await p.goto(batchUrl);
    await W(SUP, 'wf_batch_ready', 'Batch ready to start', 'Materials issued; the supervisor starts the batch.', p);
    await p.getByTestId('batch-start').click();
    await expect(p.locator('[data-status="IN_PROGRESS"]').first()).toBeVisible();
    await p.context().close();
  }

  // B10 Operator: execute all steps
  const OP = 'operator@novacure.demo';
  {
    const p = await login(browser, OP);
    await p.goto(batchUrl);
    await tab('Manufacturing (eBMR)')(p);
    let first = true;
    for (const code of ['DISP', 'GRAN', 'DRY', 'COMP', 'PACK']) {
      const card = p.getByTestId(`step-${code}`);
      await card.getByTestId(`start-${code}`).click();
      const eq = p.getByTestId('step-equipment');
      if (await eq.count()) await eq.selectOption({ index: 1 });
      await submitDialog(p);
      await card.getByTestId(`complete-${code}`).click();
      const dialog = p.getByRole('dialog');
      for (const [tid, v] of Object.entries(STEP_VALUES[code])) await dialog.getByTestId(tid).fill(v);
      if (code === 'PACK') await dialog.getByTestId('step-output').fill('199200');
      await dialog.getByLabel(/Re-enter your password/).fill(PASSWORD);
      if (first || code === 'COMP') await W(OP, `wf_ebmr_complete_${code.toLowerCase()}`, `Complete and sign step ${code}`, 'Recording parameters and in-process checks, then signing the step.', p, { dialog: true });
      first = false;
      await dialog.getByTestId('sign-submit').click();
      await expect(dialog).toBeHidden({ timeout: 30_000 });
      await expect(card.locator('[data-status="COMPLETED"]').first()).toBeVisible();
    }
    await W(OP, 'wf_ebmr_all_completed', 'All steps completed', 'All eBMR steps completed and signed; awaiting supervisor verification.', p, { fullPage: true });
    await p.context().close();
  }

  // B11 Supervisor: verify
  {
    const p = await login(browser, SUP);
    await p.goto(batchUrl);
    await tab('Manufacturing (eBMR)')(p);
    let first = true;
    for (const code of ['DISP', 'GRAN', 'DRY', 'COMP', 'PACK']) {
      await p.getByTestId(`verify-${code}`).click();
      await signDialog(p);
      if (first) await W(SUP, 'wf_ebmr_verify_signature', 'Verify a step with e-signature', 'Supervisor verification of an operator step (a different person must verify).', p, { dialog: true });
      first = false;
      await confirmSign(p);
      await expect(p.getByTestId(`step-${code}`).locator('[data-status="VERIFIED"]').first()).toBeVisible();
    }
    await W(SUP, 'wf_ebmr_verified', 'All steps verified', 'Every step verified; the batch can be completed.', p, { fullPage: true });
    await p.context().close();
  }

  // B12 Production manager: complete
  const PM = 'production.manager@novacure.demo';
  {
    const p = await login(browser, PM);
    await p.goto(batchUrl);
    await p.getByTestId('batch-complete').click();
    await expect(p.getByRole('dialog').getByText(/Calculated yield/)).toBeVisible();
    await W(PM, 'wf_batch_complete_dialog', 'Complete manufacturing', 'Completion shows the calculated yield against tolerance.', p, { dialog: true });
    await submitDialog(p);
    await expect(p.locator('[data-status="AWAITING_QC"]').first()).toBeVisible();
    await W(PM, 'wf_batch_awaiting_qc', 'Batch awaiting QC', 'Finished goods in QUARANTINE; finished-product QC requested.', p);
    await p.context().close();
  }

  // B13 FP QC
  let fpUrl = '';
  {
    const p = await login(browser, QCA);
    await p.goto(batchUrl);
    await tab(/^QC/)(p);
    await p.getByRole('link', { name: /QCS-/ }).first().click();
    await p.waitForURL('**/quality/samples/*', { timeout: 30_000 });
    fpUrl = p.url();
    await p.getByTestId('sample-collect').click();
    await submitDialog(p);
    const vals: Record<string, string | boolean> = { Description: true, Assay: '100.1', 'Dissolution (30 min)': '90.5', 'Disintegration time': '6' };
    for (const [t, v] of Object.entries(vals)) {
      const row = p.getByTestId(`test-row-${t}`);
      if (typeof v === 'boolean') await row.getByLabel(`${t} result`).selectOption('true');
      else await row.getByLabel(`${t} result`).fill(v);
    }
    await W(QCA, 'wf_fp_results_entry', 'Finished-product results', 'Finished-product test results entered against the product specification.', p, { fullPage: true });
    await p.getByTestId('save-results').click();
    await expect(p.getByText('Results recorded')).toBeVisible();
    await p.getByTestId('sample-submit').click();
    await expect(p.locator('[data-status="SUBMITTED"]').first()).toBeVisible();
    await p.context().close();
    const m = await login(browser, QCM);
    await m.goto(fpUrl);
    await m.getByTestId('sample-review').click();
    await m.getByTestId('sample-approve').click();
    await signDialog(m);
    await confirmSign(m);
    await m.context().close();
  }

  // B14 QA manager: batch release
  const QAM = 'qa.manager@novacure.demo';
  {
    const p = await login(browser, QAM);
    await p.goto(batchUrl);
    await expect(p.getByText('Ready for QA release')).toBeVisible();
    await W(QAM, 'wf_batch_ready_release', 'Batch ready for QA release', 'All release checks satisfied; QA can release or reject.', p);
    await annotate(p, slugOf(QAM), 'wf_batch_ready_release', [
      { loc: p.getByText('Ready for QA release'), label: 'Server-side release checks all satisfied' },
      { loc: p.getByTestId('batch-release'), label: 'QA release (opens the electronic signature)' },
      { loc: p.getByTestId('batch-reject'), label: 'Reject (reason and signature required)' },
      { loc: p.getByRole('tab', { name: 'Audit trail' }), label: 'Audit trail of the batch' },
    ]);
    await p.getByTestId('batch-release').click();
    await signDialog(p, 'Batch record and QC results reviewed; released.');
    await W(QAM, 'wf_batch_release_signature', 'Release a batch with e-signature', 'QA batch release with reason and password re-entry.', p, { dialog: true });
    await annotate(p, slugOf(QAM), 'wf_batch_release_signature', [
      { loc: p.getByRole('dialog').getByText('Meaning'), label: 'Meaning of the signature, recorded with it' },
      { loc: p.getByRole('dialog').getByLabel(/Reason|comment/i), label: 'Reason / comment' },
      { loc: p.getByRole('dialog').getByLabel(/Re-enter your password/), label: 'Re-enter your password (re-authentication)' },
      { loc: p.getByRole('dialog').getByTestId('sign-submit'), label: 'Sign and release' },
    ], { dialog: true });
    await confirmSign(p);
    await expect(p.locator('[data-status="RELEASED"]').first()).toBeVisible();
    await W(QAM, 'wf_batch_released', 'Batch released', 'Released batch; finished goods are now RELEASED.', p);
    await tab('Audit trail')(p);
    await W(QAM, 'wf_batch_audit', 'Batch audit trail', 'Batch audit trail showing signed events.', p);
    await p.goto('/audit-trail');
    await settle(p);
    await p.getByTestId('audit-verify').click();
    await expect(p.getByText('Hash chain verified')).toBeVisible();
    await W(QAM, 'wf_audit_verified', 'Audit trail integrity check', 'Hash-chain verification of the audit trail.', p);
    await p.context().close();
  }

  // B15 Deviation raised by QA officer from the OOS batch; classified by QA manager
  let devUrl = '';
  {
    const p = await login(browser, QAO);
    await p.goto('/quality/deviations/new');
    await settle(p);
    await p.getByTestId('dev-title').fill('Label roll partially torn at packaging line 2');
    await p.getByTestId('dev-description').fill('During packaging set-up the printed foil roll was found torn on 3 m; segment removed and quarantined.');
    await p.getByTestId('dev-action').fill('Torn segment removed and segregated; line supervisor informed.');
    await W(QAO, 'wf_deviation_create_form', 'Raise a deviation', 'Deviation form: what happened, immediate action and affected records.', p, { fullPage: true });
    await p.getByTestId('dev-submit').click();
    await p.waitForURL(/deviations\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    devUrl = p.url();
    await W(QAO, 'wf_deviation_submitted', 'Deviation submitted', 'Submitted deviation awaiting QA review.', p);
    await p.context().close();
    const q = await login(browser, QAM);
    await q.goto(devUrl);
    await q.getByTestId('dev-start-review').click();
    await settle(q, 800);
    await q.getByTestId('dev-classify').click();
    await q.getByTestId('dev-class-select').selectOption('MINOR');
    await q.getByTestId('dev-owner-select').selectOption({ index: 1 });
    await q.getByRole('dialog').getByLabel('QA review notes').fill('Packaging material handling; no product impact expected.');
    await W(QAM, 'wf_deviation_classify_dialog', 'Classify and assign a deviation', 'QA classifies severity and assigns the investigation owner.', q, { dialog: true });
    await submitDialog(q);
    await W(QAM, 'wf_deviation_investigation', 'Deviation in investigation', 'Classified deviation in INVESTIGATION with owner and due date.', q);
    await q.context().close();
  }

  // B16 OOS phase recording on the scenario-B investigation
  if (ids.oos) {
    const p = await login(browser, QAO);
    await p.goto(`/quality/oos/${ids.oos}`);
    await settle(p);
    await W(QAO, 'wf_oos_phase', 'OOS investigation phase', 'Recording the current OOS investigation phase.', p, { fullPage: true });
    await p.context().close();
  }

  // B17 CAPA form
  {
    const p = await login(browser, QAM);
    await p.goto('/quality/capa/new');
    await settle(p);
    await p.getByTestId('capa-problem').fill('Printed foil rolls damaged during internal transport.');
    await p.getByTestId('capa-add-action').click();
    await p.getByTestId('capa-action-0').fill('Introduce protective end caps for printed foil rolls');
    await W(QAM, 'wf_capa_create_form', 'Create a CAPA', 'CAPA form with problem statement, actions and the optional AI drafting assistant.', p, { fullPage: true });
    await p.context().close();
  }

  // B18 Copilot answer (deterministic fallback when no AI key)
  {
    const MV = 'management@novacure.demo';
    const p = await login(browser, MV);
    await p.goto('/copilot');
    await settle(p);
    await p.getByPlaceholder('Ask a question about your operation…').fill('Which CAPAs are overdue?');
    await p.getByRole('button', { name: 'Send' }).click();
    await expect(p.getByTestId('copilot-messages').getByText(/CAPA/).first()).toBeVisible({ timeout: 30_000 });
    await settle(p, 800);
    await W(MV, 'wf_copilot_answer', 'Copilot answer with citations', 'Copilot answer built from computed facts, with links to the source records.', p);
    await p.context().close();
  }

  // B19 Admin: new user dialog
  {
    const CA = 'company.admin@novacure.demo';
    const p = await login(browser, CA);
    await p.goto('/admin/users');
    await settle(p);
    await p.getByRole('button', { name: 'New user' }).click();
    await expect(p.getByRole('dialog')).toBeVisible();
    await W(CA, 'wf_user_create_dialog', 'Create a user', 'New user: identity, initial password and role assignment with optional site scope.', p, { dialog: true });
    await p.keyboard.press('Escape');
    await p.context().close();
  }

  writePart('workflow');
  console.log(`Workflow captured ${manifest.shots.length} screenshots, ${manifest.failures.length} failures`);
});
