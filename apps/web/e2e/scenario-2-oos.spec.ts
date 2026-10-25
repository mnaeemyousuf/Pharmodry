/**
 * UI scenario 2 — failed dissolution: OOS flagged, release blocked, investigation, deviation, CAPA,
 * QA conclusion, batch rejected.
 */
import { expect, test } from '@playwright/test';
import { enterResults, loginAs, manufacturePcmBatch, sign, submitDialog, USERS } from './helpers';

test('OOS dissolution result blocks release and is investigated to closure', async ({ browser }) => {
  const batchUrl = await manufacturePcmBatch(browser, '197900');

  // QC enters 74 % dissolution → flagged as OOS candidate, investigation opened
  const analyst = await loginAs(browser, USERS.qcAnalyst);
  await analyst.goto(batchUrl);
  await analyst.getByRole('tab', { name: /^QC/ }).click();
  await analyst.getByRole('link', { name: /QCS-/ }).first().click();
  await analyst.waitForURL('**/quality/samples/*');
  const sampleUrl = analyst.url();
  await enterResults(analyst, { Description: true, Assay: '99.3', 'Dissolution (30 min)': '74', 'Disintegration time': '12' });
  await expect(analyst.getByText(/OOS candidate flagged/)).toBeVisible();
  await expect(analyst.getByText('OOS investigation open — approval and release are blocked')).toBeVisible();
  await analyst.getByTestId('sample-submit').click();
  await analyst.context().close();

  // QA release is blocked
  const qa = await loginAs(browser, USERS.qaManager);
  await qa.goto(batchUrl);
  await expect(qa.getByText('QA release is blocked')).toBeVisible();
  await expect(qa.getByTestId('batch-release')).toHaveCount(0);
  await qa.getByRole('tab', { name: /^QC/ }).click();
  await qa.getByRole('link', { name: /OOS-/ }).first().click();
  await qa.waitForURL('**/quality/oos/*');
  const oosUrl = qa.url();
  await expect(qa.getByText(/has not decided whether it is a true OOS/)).toBeVisible();

  // Investigator records phases
  const qo = await loginAs(browser, USERS.qaOfficer);
  await qo.goto(oosUrl);
  await qo.getByTestId('oos-advance').click();
  await expect(qo.locator('[data-status="PRELIMINARY_INVESTIGATION"]').first()).toBeVisible();
  await qo.getByTestId('oos-phase-text').fill('Calculations, dilutions and sample identity verified; no obvious error.');
  await qo.getByTestId('oos-advance').click();
  await expect(qo.locator('[data-status="LAB_INVESTIGATION"]').first()).toBeVisible();
  await qo.getByTestId('oos-phase-text').fill('Media, apparatus and standards verified; re-measurement confirmed 74 %.');
  await qo.getByTestId('oos-lab-error').selectOption('false');
  await qo.getByTestId('oos-advance').click();
  await expect(qo.locator('[data-status="MANUFACTURING_INVESTIGATION"]').first()).toBeVisible();

  // Deviation raised from the OOS
  await qo.getByRole('link', { name: 'Raise deviation' }).click();
  await qo.getByTestId('dev-title').fill('Dissolution OOS — compression hardness high');
  await qo.getByTestId('dev-description').fill('FP dissolution 74 % vs ≥ 80 %. Compression hardness at upper end of IPC range.');
  await qo.getByTestId('dev-action').fill('Batch held in quarantine; QA informed.');
  await qo.getByTestId('dev-submit').click();
  await expect(qo).toHaveURL(/\/quality\/deviations\/[0-9a-f-]{36}$/);
  const devUrl = qo.url();
  await qa.goto(devUrl);
  await qa.getByTestId('dev-start-review').click();
  await qa.getByTestId('dev-classify').click();
  await qa.getByTestId('dev-class-select').selectOption('MAJOR');
  await qa.getByTestId('dev-owner-select').selectOption({ index: 1 });
  await qa.getByRole('dialog').getByLabel('QA review notes').fill('Linked to OOS; potential product impact.');
  await submitDialog(qa);
  await expect(qa.locator('[data-status="INVESTIGATION"]').first()).toBeVisible();

  // Root cause and impact recorded, CAPA generated from the OOS
  await qo.goto(oosUrl);
  await qo.getByTestId('oos-phase-text').fill('Compression force at upper range; average hardness 11.6 kp.');
  await qo.getByTestId('oos-advance').click();
  await expect(qo.locator('[data-status="ROOT_CAUSE"]').first()).toBeVisible();
  await qo.getByTestId('oos-phase-text').fill('Excessive compression force produced harder tablets with slower dissolution.');
  await qo.getByTestId('oos-advance').click();
  await expect(qo.locator('[data-status="IMPACT_ASSESSMENT"]').first()).toBeVisible();
  await qo.getByTestId('oos-phase-text').fill('This batch only; other batches compressed within range.');
  await qo.getByTestId('oos-advance').click();
  await expect(qo.locator('[data-status="CAPA"]').first()).toBeVisible();
  await qo.getByRole('link', { name: 'Create CAPA' }).click();
  await qo.getByTestId('capa-add-action').click();
  await qo.getByTestId('capa-action-0').fill('Narrow compression force limits in master eBMR');
  await qo.getByTestId('capa-submit').click();
  await expect(qo).toHaveURL(/\/quality\/capa\/[0-9a-f-]{36}$/);
  await qo.goto(oosUrl);
  await qo.getByTestId('oos-advance').click();
  await expect(qo.locator('[data-status="QA_APPROVAL"]').first()).toBeVisible();
  await qo.context().close();

  // QA concludes CONFIRMED OOS with e-signature
  await qa.goto(oosUrl);
  await qa.getByTestId('oos-confirm').click();
  await sign(qa, 'Investigation confirms a true OOS; no laboratory error.');
  await expect(qa.locator('[data-status="CLOSED"]').first()).toBeVisible();

  // QC approval concludes FAIL; QA rejects the batch
  const qcm = await loginAs(browser, USERS.qcManager);
  await qcm.goto(sampleUrl);
  await qcm.getByTestId('sample-review').click();
  await qcm.getByTestId('sample-approve').click();
  await sign(qcm);
  await expect(qcm.locator('[data-status="FAIL"]').first()).toBeVisible();
  await qcm.context().close();
  await qa.goto(batchUrl);
  await expect(qa.getByTestId('batch-release')).toBeDisabled();
  await qa.getByTestId('batch-reject').click();
  await sign(qa, 'Confirmed dissolution OOS — batch rejected.');
  await expect(qa.locator('[data-status="REJECTED"]').first()).toBeVisible();

  // Audit trail and dashboard updated
  await qa.goto('/audit-trail');
  await qa.getByTestId('audit-verify').click();
  await expect(qa.getByText('Hash chain verified')).toBeVisible();
  await qa.goto('/dashboard');
  await expect(qa.getByText('OOS trend')).toBeVisible();
  await qa.context().close();
});
