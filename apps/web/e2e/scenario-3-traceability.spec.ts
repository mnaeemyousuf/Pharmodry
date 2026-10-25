/**
 * UI scenario 3 — QA traces a batch (mock recall + backward genealogy) and opens the PQR data pack.
 */
import { expect, test } from '@playwright/test';
import { loginAs, USERS } from './helpers';

test('trace a batch, reconcile a mock recall and open the PQR data pack, ask the Copilot', async ({ browser }) => {
  const qa = await loginAs(browser, USERS.qaManager);
  await qa.goto('/traceability');
  await qa.getByTestId('trace-search').fill('PCM');
  await qa.getByRole('button', { name: 'Trace' }).click();
  await qa.locator('button', { hasText: /^batch/i }).first().click();
  await qa.waitForURL('**/traceability?batch=*');
  await expect(qa.getByText(/Quantities reconcile|Reconciliation gap/)).toBeVisible();
  await expect(qa.getByText(/distribution system/).first()).toBeVisible();
  await qa.getByRole('tab', { name: /Backward genealogy/ }).click();
  await expect(qa.getByText('Input material lots')).toBeVisible();

  // Printable batch record carries the brand and the GS1 element string
  const batchId = new URL(qa.url()).searchParams.get('batch');
  await qa.goto(`/production/batches/${batchId}/record`);
  await expect(qa.getByTestId('bmr-header').getByText('Pharmodry').first()).toBeVisible();
  await expect(qa.getByText('Executed Batch Manufacturing Record')).toBeVisible();
  await expect(qa.getByText('GS1 element string')).toBeVisible();

  await qa.goto('/quality/pqr');
  await expect(qa.getByRole('heading', { name: 'Product Quality Review data pack' })).toBeVisible();
  await expect(qa.getByText('1. Batches manufactured')).toBeVisible();
  await expect(qa.getByText('Sections not captured in this release')).toBeVisible();

  // Copilot renders an answer with sources (regression: page crashed when the answer arrived)
  const errors: string[] = [];
  qa.on('pageerror', (e) => errors.push(e.message));
  await qa.goto('/copilot');
  await qa.getByPlaceholder('Ask a question about your operation…').fill('Which CAPAs are overdue?');
  await qa.getByRole('button', { name: 'Send' }).click();
  await expect(qa.getByTestId('copilot-messages').getByText(/^Sources \(\d+\)$/)).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});
