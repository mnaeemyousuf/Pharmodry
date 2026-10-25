/** Scenario 4 — exception handling, deviation and CAPA workflows, AI fallback. */
import { closeContext, createContext, Ctx, days, sign, U } from './helpers';

describe('Exception handling and quality workflows', () => {
  let c: Ctx;
  const ids: Record<string, string> = {};
  beforeAll(async () => {
    c = await createContext();
    ids.site = (await c.prisma.site.findFirstOrThrow({ where: { code: 'KHI' } })).id;
    ids.wh = (await c.prisma.warehouse.findFirstOrThrow({ where: { code: 'WH-RM' } })).id;
    ids.mcc = (await c.prisma.material.findFirstOrThrow({ where: { code: 'EXC-MCC-101' } })).id;
    ids.sup3 = (await c.prisma.supplier.findFirstOrThrow({ where: { code: 'SUP-003' } })).id;
  });
  afterAll(() => closeContext(c));
  const grn = (over: Record<string, unknown> = {}, line: Record<string, unknown> = {}) => ({
    siteId: ids.site,
    supplierId: ids.sup3,
    lines: [{ materialId: ids.mcc, supplierBatch: 'EX-1', quantity: 10, mfgDate: days(-10), expiryDate: days(400), warehouseId: ids.wh, ...line }],
    ...over,
  });

  it('refuses expired material at receipt', async () => {
    const r = await (await c.as(U.warehouseOfficer)).post('/goods-receipts', grn({}, { mfgDate: days(-800), expiryDate: days(-1) })).expect(422);
    expect(r.body.error.message).toMatch(/expired/);
  });
  it('refuses receipt from a suspended supplier and of unapproved materials', async () => {
    const wo = await c.as(U.warehouseOfficer);
    const suspended = await c.prisma.supplier.findFirstOrThrow({ where: { code: 'SUP-008' } });
    const r = await wo.post('/goods-receipts', grn({ supplierId: suspended.id })).expect(422);
    expect(r.body.error.details.reasons[0].code).toBe('SUPPLIER_NOT_QUALIFIED');
    const api = await c.prisma.material.findFirstOrThrow({ where: { code: 'API-AMX-001' } });
    const r2 = await wo.post('/goods-receipts', grn({}, { materialId: api.id })).expect(422);
    expect(r2.body.error.details.reasons[0].code).toBe('MATERIAL_NOT_APPROVED_FOR_SUPPLIER');
  });
  it('rejects expiry before manufacturing date', async () => {
    await (await c.as(U.warehouseOfficer)).post('/goods-receipts', grn({}, { mfgDate: days(-10), expiryDate: days(-20) })).expect(400);
  });
  it('blocks reservation when released stock is insufficient (quarantined stock is never used)', async () => {
    const batch = await c.prisma.batch.findFirstOrThrow({ where: { batchNumber: { startsWith: 'AMX-' }, status: 'PLANNED' } });
    const r = await (await c.as(U.planner)).post(`/batches/${batch.id}/reserve`).expect(422);
    expect(r.body.error.code).toBe('MATERIAL_SHORTAGE');
    expect(await c.prisma.materialReservation.count({ where: { batchId: batch.id } })).toBe(0); // all-or-nothing
  });
  it('refuses to submit a QC sample with missing mandatory results', async () => {
    const res = await (await c.as(U.warehouseOfficer)).post('/goods-receipts', grn()).expect(201);
    const line = await c.prisma.goodsReceiptLine.findFirstOrThrow({ where: { goodsReceiptId: res.body.data.id } });
    const sample = await c.prisma.qcSample.findFirstOrThrow({ where: { lotId: line.lotId } });
    const qc = await c.as(U.qcAnalyst);
    await qc.post(`/qc/samples/${sample.id}/collect`, {}).expect(200);
    const tests = await c.prisma.qcSpecTest.findMany({ where: { specificationId: sample.specificationId }, orderBy: { sequence: 'asc' } });
    await qc.post(`/qc/samples/${sample.id}/results`, { results: [{ specTestId: tests[0].id, passFail: true }] }).expect(200);
    const r = await qc.post(`/qc/samples/${sample.id}/submit`).expect(422);
    expect(r.body.error.details.reasons[0].code).toBe('MISSING_RESULT');
    // correcting an entered value requires a reason; the original is kept as INVALIDATED
    await qc.post(`/qc/samples/${sample.id}/results`, { results: [{ specTestId: tests[0].id, passFail: true }] }).expect(400);
    await qc.post(`/qc/samples/${sample.id}/results`, { results: [{ specTestId: tests[0].id, passFail: true, correctionReason: 'Transcription check' }] }).expect(200);
    expect(await c.prisma.qcResult.count({ where: { sampleId: sample.id, status: 'INVALIDATED' } })).toBe(1);
  });
  it('blocks equipment with expired calibration in the eBMR (BLOCK policy)', async () => {
    const batch = await c.prisma.batch.findFirstOrThrow({ where: { batchNumber: { startsWith: 'OMZ-' }, status: 'IN_PROGRESS' } });
    const step = await c.prisma.batchStep.findFirstOrThrow({ where: { batchId: batch.id, status: 'PENDING' }, orderBy: { sequence: 'asc' } });
    const tp2 = await c.prisma.equipment.findFirstOrThrow({ where: { code: 'TP-02' } });
    const r = await (await c.as(U.operator)).post(`/batches/${batch.id}/steps/${step.id}/start`, { equipmentId: tp2.id });
    expect(r.status).toBe(400); // wrong type for encapsulation step — type check precedes calibration
    const enc = await c.prisma.equipment.findFirstOrThrow({ where: { code: 'ENC-01' } });
    await c.prisma.equipment.update({ where: { id: enc.id }, data: { nextCalibrationDue: new Date(Date.now() - 86_400_000) } });
    const r2 = await (await c.as(U.operator)).post(`/batches/${batch.id}/steps/${step.id}/start`, { equipmentId: enc.id }).expect(422);
    expect(r2.body.error.code).toBe('CALIBRATION_EXPIRED');
    await c.prisma.equipment.update({ where: { id: enc.id }, data: { nextCalibrationDue: new Date(Date.now() + 30 * 86_400_000) } });
  });
  it('the person who performed a step cannot verify it (segregation of duties)', async () => {
    const batch = await c.prisma.batch.findFirstOrThrow({ where: { batchNumber: { startsWith: 'OMZ-' }, status: 'IN_PROGRESS' } });
    const step = await c.prisma.batchStep.findFirstOrThrow({ where: { batchId: batch.id, status: 'PENDING' }, orderBy: { sequence: 'asc' } });
    const enc = await c.prisma.equipment.findFirstOrThrow({ where: { code: 'ENC-01' } });
    const sup = await c.as(U.supervisor);
    await sup.post(`/batches/${batch.id}/steps/${step.id}/start`, { equipmentId: enc.id }).expect(200);
    const missing = await sup.post(`/batches/${batch.id}/steps/${step.id}/complete`, { ...sign, readings: {}, ipcResults: {} }).expect(400);
    expect(missing.body.error.message).toMatch(/Missing required readings/);
    const out = await sup.post(`/batches/${batch.id}/steps/${step.id}/complete`, { ...sign, readings: { rh: 52 }, ipcResults: { fillWeight: 236 } }).expect(422);
    expect(out.body.error.message).toMatch(/remarks/);
    await sup.post(`/batches/${batch.id}/steps/${step.id}/complete`, { ...sign, readings: { rh: 52 }, ipcResults: { fillWeight: 236 }, remarks: 'RH excursion; dehumidifier restarted, deviation raised.' }).expect(200);
    const r = await sup.post(`/batches/${batch.id}/steps/${step.id}/verify`, sign).expect(422);
    expect(r.body.error.message).toMatch(/Segregation of duties/);
    const corr = await sup.post(`/batches/${batch.id}/steps/${step.id}/corrections`, { field: 'readings.rh', newValue: 44, reason: 'Hygrometer reading transcribed incorrectly' }).expect(201);
    expect(corr.body.data.readings.rh).toBe(44);
    const log = await c.prisma.batchStepCorrection.findFirstOrThrow({ where: { batchStepId: step.id } });
    expect(log.originalValue).toBe(52);
  });

  describe('deviation → CAPA lifecycle', () => {
    it('runs a deviation through review, investigation, RCA, CAPA and closure', async () => {
      const sup = await c.as(U.supervisor);
      const d = await sup
        .post('/deviations', { siteId: ids.site, title: 'Label reconciliation discrepancy on packing line', description: 'Printed foil count mismatch of 120 units at end of run.', immediateAction: 'Line stopped; materials quarantined.', occurredAt: new Date().toISOString(), category: 'PACKING' })
        .expect(201);
      ids.dev = d.body.data.id;
      expect(d.body.data.status).toBe('DRAFT');
      const qa = await c.as(U.qaManager);
      await qa.post(`/deviations/${ids.dev}/start-review`).expect(409); // must be submitted first
      await sup.post(`/deviations/${ids.dev}/submit`).expect(200);
      await qa.post(`/deviations/${ids.dev}/start-review`).expect(200);
      const owner = await c.prisma.user.findFirstOrThrow({ where: { email: U.qaOfficer } });
      await qa.post(`/deviations/${ids.dev}/classify`, { classification: 'MAJOR', ownerId: owner.id, qaReviewNotes: 'Potential mix-up risk' }).expect(200);
      const qo = await c.as(U.qaOfficer);
      await qo.post(`/deviations/${ids.dev}/investigation`, { investigationSummary: 'Foil roll changeover not reconciled by operator.', impactAssessment: 'No mix-up; counts reconciled.' }).expect(200);
      await qo.post(`/deviations/${ids.dev}/root-cause`, { fiveWhys: [{ question: 'Why mismatch?', answer: 'Changeover not recorded' }], fishbone: { METHOD: ['No changeover reconciliation step'] }, primaryCategory: 'METHOD', statement: 'SOP lacks a reconciliation step at foil roll changeover.' }).expect(201);
      await qa.post(`/deviations/${ids.dev}/approve-root-cause`).expect(200);
      const noCapa = await qa.post(`/deviations/${ids.dev}/capa-decision`, { capaRequired: true }).expect(422);
      expect(noCapa.body.error.details.reasons[0].code).toBe('CAPA_MISSING');
      const capa = await qo
        .post('/capas', { siteId: ids.site, source: 'DEVIATION', deviationId: ids.dev, problemStatement: 'Foil reconciliation missing at changeover', priority: 'MEDIUM', ownerId: owner.id, dueDate: days(30), actions: [{ type: 'PREVENTIVE', description: 'Add reconciliation step to packing SOP', ownerId: owner.id, dueDate: days(14) }] })
        .expect(201);
      ids.capa = capa.body.data.id;
      await qa.post(`/deviations/${ids.dev}/capa-decision`, { capaRequired: true }).expect(200);
      const close = await qa.post(`/deviations/${ids.dev}/close`, { ...sign, effectivenessSummary: 'Awaiting CAPA effectiveness evidence.' }).expect(422);
      expect(close.body.error.details.reasons[0].code).toBe('CAPA_OPEN');
    });

    it('CAPA cannot close without a successful effectiveness check; a failed check is counted', async () => {
      const qo = await c.as(U.qaOfficer);
      const qa = await c.as(U.qaManager);
      await qa.post(`/capas/${ids.capa}/close`, sign).expect(422);
      await qo.post(`/capas/${ids.capa}/submit-effectiveness`).expect(422); // open actions remain
      const action = await c.prisma.capaAction.findFirstOrThrow({ where: { capaId: ids.capa } });
      await qo.post(`/capas/${ids.capa}/actions/${action.id}/complete`, { evidence: 'SOP PK-012 rev 4 issued' }).expect(200);
      await qo.post(`/capas/${ids.capa}/submit-effectiveness`).expect(200);
      await qo.post(`/capas/${ids.capa}/effectiveness`, { effective: false, result: 'Repeat discrepancy observed in next run.' }).expect(200);
      let capa = await c.prisma.capa.findUniqueOrThrow({ where: { id: ids.capa } });
      expect(capa.status).toBe('IN_PROGRESS');
      expect(capa.effectivenessFailures).toBe(1);
      await qo.post(`/capas/${ids.capa}/submit-effectiveness`).expect(200);
      await qo.post(`/capas/${ids.capa}/effectiveness`, { effective: true, result: 'No discrepancy across the next five runs.' }).expect(200);
      await (await c.as(U.qcAnalyst)).post(`/capas/${ids.capa}/close`, sign).expect(403);
      await qa.post(`/capas/${ids.capa}/close`, sign).expect(200);
      capa = await c.prisma.capa.findUniqueOrThrow({ where: { id: ids.capa } });
      expect(capa.status).toBe('CLOSED');
      await qa.post(`/deviations/${ids.dev}/close`, { ...sign, effectivenessSummary: 'CAPA verified effective; no recurrence.' }).expect(200);
      expect((await c.prisma.deviation.findUniqueOrThrow({ where: { id: ids.dev } })).status).toBe('CLOSED');
      expect(await c.prisma.electronicSignature.count({ where: { entityId: { in: [ids.dev, ids.capa] } } })).toBe(2);
    });

    it('overdue CAPAs raise notifications through the compliance scan', async () => {
      const r = await (await c.as(U.companyAdmin)).post('/admin/jobs/run-scans').expect(200);
      expect(r.body.data.capaOverdue).toBeGreaterThanOrEqual(0);
      const n = await c.prisma.notification.count({ where: { event: 'CAPA_OVERDUE' } });
      expect(n).toBeGreaterThan(0);
    });
  });

  describe('AI is assistive only and degrades gracefully', () => {
    it('answers from computed facts with citations when no provider is configured', async () => {
      const r = await (await c.as(U.management)).post('/ai/copilot/ask', { question: 'Which CAPAs are overdue?' }).expect(200);
      expect(r.body.data.aiGenerated).toBe(false);
      expect(r.body.data.intent).toBe('OVERDUE_CAPAS');
      expect(r.body.data.answer).toMatch(/AI provider not configured/);
      expect(r.body.data.citations.length).toBeGreaterThan(0);
    });
    it('requires the copilot permission and respects domain permissions in retrieval', async () => {
      await (await c.as(U.operator)).post('/ai/copilot/ask', { question: 'Which CAPAs are overdue?' }).expect(403);
      const r = await (await c.as(U.planner)).post('/ai/copilot/ask', { question: 'Which CAPAs are overdue?' }).expect(200);
      expect(r.body.data.answer).toMatch(/do not have access/);
      expect(r.body.data.citations).toHaveLength(0);
    });
    it('CAPA drafting reports unavailability instead of inventing suggestions', async () => {
      const r = await (await c.as(U.qaManager)).post('/ai/capa/draft', { deviationId: ids.dev }).expect(503);
      expect(r.body.error.code).toBe('AI_NOT_CONFIGURED');
    });
  });
});
