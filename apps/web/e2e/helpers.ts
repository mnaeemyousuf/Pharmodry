import { Browser, expect, Page } from '@playwright/test';

export const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Pharmodry!Demo26';

export const USERS = {
  warehouseOfficer: 'warehouse.officer@novacure.demo',
  qcAnalyst: 'qc.analyst@novacure.demo',
  qcManager: 'qc.manager@novacure.demo',
  qaOfficer: 'qa.officer@novacure.demo',
  qaManager: 'qa.manager@novacure.demo',
  planner: 'planner@novacure.demo',
  supervisor: 'production.supervisor@novacure.demo',
  operator: 'operator@novacure.demo',
  productionManager: 'production.manager@novacure.demo',
  management: 'management@novacure.demo',
};

/** Fresh browser context per user (separate cookies), logged in through the real login form. */
export async function loginAs(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  return page;
}

/** Completes the electronic-signature dialog (password re-entry). */
export async function sign(page: Page, reason?: string) {
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Electronic signature')).toBeVisible();
  if (reason) await dialog.getByLabel(/Reason|Justification|comment/i).first().fill(reason);
  await dialog.getByLabel(/Re-enter your password/).fill(PASSWORD);
  await dialog.getByTestId('sign-submit').click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

export async function submitDialog(page: Page) {
  const dialog = page.getByRole('dialog');
  await dialog.getByTestId('action-submit').click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

export const STEP_VALUES: Record<string, Record<string, string>> = {
  DISP: { 'param-roomTemp': '21', 'param-rh': '45' },
  GRAN: { 'param-mixTime': '10', 'param-impeller': '150' },
  DRY: { 'param-inletTemp': '60', 'ipc-lod': '1.2' },
  COMP: { 'param-speed': '30', 'ipc-avgWeight': '650', 'ipc-hardness': '9', 'ipc-friability': '0.4' },
  PACK: { 'param-sealTemp': '195', 'ipc-leakTest': '0' },
};

/** Creates a Paracetamol batch through the UI and drives it to AWAITING_QC. Returns the batch URL. */
export async function manufacturePcmBatch(browser: Browser, output: string): Promise<string> {
  const planner = await loginAs(browser, USERS.planner);
  await planner.goto('/production/batches/new');
  await planner.getByTestId('batch-product').selectOption({ label: 'PCM-500 — Paracetamol 500 mg' });
  await expect(planner.getByText('All materials available')).toBeVisible();
  await planner.getByTestId('batch-submit').click();
  await expect(planner).toHaveURL(/\/production\/batches\/[0-9a-f-]{36}$/);
  const url = planner.url();
  await planner.getByTestId('batch-reserve').click();
  await expect(planner.locator('[data-status="MATERIAL_RESERVED"]').first()).toBeVisible();
  await planner.context().close();

  const wh = await loginAs(browser, USERS.warehouseOfficer);
  await wh.goto(url);
  await wh.getByTestId('batch-issue').click();
  await expect(wh.locator('[data-status="READY"]').first()).toBeVisible();
  await wh.context().close();

  const sup = await loginAs(browser, USERS.supervisor);
  await sup.goto(url);
  await sup.getByTestId('batch-start').click();
  await expect(sup.locator('[data-status="IN_PROGRESS"]').first()).toBeVisible();

  const op = await loginAs(browser, USERS.operator);
  await op.goto(url);
  for (const code of ['DISP', 'GRAN', 'DRY', 'COMP', 'PACK']) {
    const card = op.getByTestId(`step-${code}`);
    await card.getByTestId(`start-${code}`).click();
    const eq = op.getByTestId('step-equipment');
    if (await eq.count()) await eq.selectOption({ index: 1 });
    await submitDialog(op);
    await card.getByTestId(`complete-${code}`).click();
    const dialog = op.getByRole('dialog');
    for (const [tid, v] of Object.entries(STEP_VALUES[code])) await dialog.getByTestId(tid).fill(v);
    if (code === 'PACK') await dialog.getByTestId('step-output').fill(output);
    await dialog.getByLabel(/Re-enter your password/).fill(PASSWORD);
    await dialog.getByTestId('sign-submit').click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    await expect(card.locator('[data-status="COMPLETED"]').first()).toBeVisible();
  }
  await op.context().close();

  await sup.reload();
  await sup.getByRole('tab', { name: 'Manufacturing (eBMR)' }).click();
  for (const code of ['DISP', 'GRAN', 'DRY', 'COMP', 'PACK']) {
    await sup.getByTestId(`verify-${code}`).click();
    await sign(sup);
    await expect(sup.getByTestId(`step-${code}`).locator('[data-status="VERIFIED"]').first()).toBeVisible();
  }
  await sup.context().close();

  const pm = await loginAs(browser, USERS.productionManager);
  await pm.goto(url);
  await pm.getByTestId('batch-complete').click();
  await expect(pm.getByRole('dialog').getByText(/Calculated yield/)).toBeVisible();
  await submitDialog(pm);
  await expect(pm.locator('[data-status="AWAITING_QC"]').first()).toBeVisible();
  await pm.context().close();
  return url;
}

/** QC analyst collects and enters results on a sample page; returns the page. */
export async function enterResults(page: Page, values: Record<string, string | boolean>) {
  await page.getByTestId('sample-collect').click();
  await submitDialog(page);
  for (const [test, v] of Object.entries(values)) {
    const row = page.getByTestId(`test-row-${test}`);
    if (typeof v === 'boolean') await row.getByLabel(`${test} result`).selectOption(v ? 'true' : 'false');
    else await row.getByLabel(`${test} result`).fill(v);
  }
  await page.getByTestId('save-results').click();
}
