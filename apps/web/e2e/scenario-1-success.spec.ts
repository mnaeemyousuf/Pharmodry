/**
 * UI scenario 1 — material receipt to released finished goods, performed by each role in the browser.
 */
import { expect, test } from '@playwright/test';
import { enterResults, loginAs, manufacturePcmBatch, sign, USERS } from './helpers';

test('receipt → quarantine → QC → QA release → batch → eBMR → QC → QA release → dashboards', async ({ browser }) => {
  // 1. Warehouse receives material (GRN) — lands in QUARANTINE with a QC sample
  const wh = await loginAs(browser, USERS.warehouseOfficer);
  await wh.goto('/inventory/receipts/new');
  await wh.getByTestId('grn-supplier').selectOption({ label: 'Lahore Excipients (Pvt) Ltd (demo) (approved)' });
  await wh.getByTestId('grn-add-line').click();
  const line = wh.getByTestId('grn-line-0');
  await line.getByLabel('Material').selectOption({ label: 'EXC-MCC-101 — Microcrystalline Cellulose PH-101' });
  await line.getByLabel('Supplier batch').fill('UI-MCC-0001');
  await line.getByLabel(/^Quantity/).fill('120');
  await line.getByLabel('Mfg date').fill('2026-09-01');
  await line.getByLabel('Expiry date').fill('2029-08-31');
  await wh.getByTestId('grn-submit').click();
  await expect(wh).toHaveURL(/\/inventory\/receipts\/[0-9a-f-]{36}$/);
  await expect(wh.locator('[data-status="QUARANTINE"]').first()).toBeVisible();
  const lotUrl = new URL((await wh.getByRole('link', { name: /^EX\d/ }).first().getAttribute('href'))!, wh.url()).pathname;
  const sampleUrl = new URL((await wh.getByRole('link', { name: /QCS-/ }).first().getAttribute('href'))!, wh.url()).pathname;
  await wh.context().close();

  // 2. QA cannot release before QC — the release button is disabled and blockers are shown
  const qaOfficer = await loginAs(browser, USERS.qaOfficer);
  await qaOfficer.goto(lotUrl);
  await expect(qaOfficer.getByText('This lot cannot be released yet')).toBeVisible();
  await expect(qaOfficer.getByTestId('lot-release')).toBeDisabled();

  // 3. QC analyst tests, QC manager reviews and approves with e-signature
  const analyst = await loginAs(browser, USERS.qcAnalyst);
  await analyst.goto(sampleUrl);
  await enterResults(analyst, { Identification: true, 'Loss on drying': '4.1' });
  await expect(analyst.getByText('Results recorded')).toBeVisible();
  await analyst.getByTestId('sample-submit').click();
  await expect(analyst.locator('[data-status="SUBMITTED"]').first()).toBeVisible();
  await analyst.context().close();
  const qcm = await loginAs(browser, USERS.qcManager);
  await qcm.goto(sampleUrl);
  await qcm.getByTestId('sample-review').click();
  await qcm.getByTestId('sample-approve').click();
  await sign(qcm);
  await expect(qcm.locator('[data-status="APPROVED"]').first()).toBeVisible();
  await qcm.context().close();

  // 4. QA releases the lot (e-signature) → RELEASED
  await qaOfficer.reload();
  await expect(qaOfficer.getByText('Ready for QA disposition')).toBeVisible();
  await qaOfficer.getByTestId('lot-release').click();
  await sign(qaOfficer);
  await expect(qaOfficer.locator('[data-status="RELEASED"]').first()).toBeVisible();
  await qaOfficer.context().close();

  // 5–13. Plan, reserve (FEFO), issue, start, execute & verify eBMR, complete (yield, FG quarantine, FP sample)
  const batchUrl = await manufacturePcmBatch(browser, '198800');

  // 14–15. FP QC
  const a2 = await loginAs(browser, USERS.qcAnalyst);
  await a2.goto(batchUrl);
  await a2.getByRole('tab', { name: /^QC/ }).click();
  await a2.getByRole('link', { name: /QCS-/ }).first().click();
  await a2.waitForURL('**/quality/samples/*');
  await enterResults(a2, { Description: true, Assay: '100.1', 'Dissolution (30 min)': '90.5', 'Disintegration time': '6' });
  await a2.getByTestId('sample-submit').click();
  const fpSampleUrl = a2.url();
  await a2.context().close();
  const qcm2 = await loginAs(browser, USERS.qcManager);
  await qcm2.goto(fpSampleUrl);
  await qcm2.getByTestId('sample-review').click();
  await qcm2.getByTestId('sample-approve').click();
  await sign(qcm2);
  await qcm2.context().close();

  // 16. QA release with e-signature
  const qa = await loginAs(browser, USERS.qaManager);
  await qa.goto(batchUrl);
  await expect(qa.getByText('Ready for QA release')).toBeVisible();
  await qa.getByTestId('batch-release').click();
  await sign(qa, 'Batch record and QC reviewed; released.');
  await expect(qa.locator('[data-status="RELEASED"]').first()).toBeVisible();

  // 17. Finished goods released
  await qa.getByRole('tab', { name: 'Overview' }).click();
  await expect(qa.getByTestId('fg-lot').locator('[data-status="RELEASED"]')).toBeVisible();

  // 19. Audit trail shows the signed release
  await qa.getByRole('tab', { name: 'Audit trail' }).click();
  await expect(qa.getByText('e-signed').first()).toBeVisible();
  await qa.context().close();

  // 18. Dashboards reflect the transaction
  const mgmt = await loginAs(browser, USERS.management);
  await mgmt.goto('/dashboard');
  await expect(mgmt.getByText('Batch release cycle time')).toBeVisible();
  await mgmt.goto('/command-center');
  await expect(mgmt.getByTestId('cc-headlines')).toBeVisible();

  // 20. Unauthorized users cannot perform restricted actions (UI hides it; API refuses it)
  await mgmt.goto(batchUrl);
  await expect(mgmt.getByTestId('batch-release')).toHaveCount(0);
  const status = await mgmt.evaluate(async (u) => {
    const id = u.split('/').pop();
    const r = await fetch(`/api/v1/batches/${id}/close`, { method: 'POST', headers: { 'X-Requested-With': 'pharmodry' } });
    return r.status;
  }, batchUrl);
  expect(status).toBe(401); // no bearer token in a raw fetch → unauthenticated
  await mgmt.context().close();
});
