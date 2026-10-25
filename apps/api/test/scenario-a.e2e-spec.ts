/**
 * Demo scenario 1 — successful batch, end to end through the API:
 * PO → GRN → QUARANTINE → QC → QA lot release → plan → batch → FEFO reservation → issue → eBMR →
 * yield → FP QC → QA release (e-sign) → FG RELEASED → dashboard & audit trail.
 */
import { closeContext, createContext, Ctx, days, executeBatch, runQc, sign, U } from './helpers';

describe('Scenario A — successful manufacturing batch', () => {
  let c: Ctx;
  const ids: Record<string, string> = {};
  beforeAll(async () => {
    c = await createContext();
  });
  afterAll(() => closeContext(c));

  it('procurement raises and approves a purchase order (segregation of duties enforced)', async () => {
    const officer = await c.as(U.procurementOfficer);
    const site = await c.prisma.site.findFirstOrThrow({ where: { code: 'KHI' } });
    const supplier = await c.prisma.supplier.findFirstOrThrow({ where: { code: 'SUP-001' } });
    const api = await c.prisma.material.findFirstOrThrow({ where: { code: 'API-PCM-001' } });
    Object.assign(ids, { site: site.id, supplier: supplier.id, material: api.id });
    const po = await officer.post('/purchase-orders', { siteId: site.id, supplierId: supplier.id, expectedDate: days(3), lines: [{ materialId: api.id, quantity: 400, unitPrice: 1250 }] }).expect(201);
    ids.po = po.body.data.id;
    ids.poLine = po.body.data.lines[0].id;
    await officer.post(`/purchase-orders/${ids.po}/approve`).expect(403);
    await (await c.as(U.procurementManager)).post(`/purchase-orders/${ids.po}/approve`).expect(200);
  });

  it('GRN creates the lot in QUARANTINE and requests a QC sample automatically', async () => {
    const wh = await c.prisma.warehouse.findFirstOrThrow({ where: { code: 'WH-RM' } });
    const res = await (await c.as(U.warehouseOfficer))
      .post('/goods-receipts', {
        siteId: ids.site,
        supplierId: ids.supplier,
        purchaseOrderId: ids.po,
        lines: [{ materialId: ids.material, poLineId: ids.poLine, supplierBatch: 'E2E-PCM-001', quantity: 400, mfgDate: days(-30), expiryDate: days(900), warehouseId: wh.id }],
      })
      .expect(201);
    const line = await c.prisma.goodsReceiptLine.findFirstOrThrow({ where: { goodsReceiptId: res.body.data.id } });
    ids.lot = line.lotId;
    const lot = await c.prisma.inventoryLot.findUniqueOrThrow({ where: { id: ids.lot } });
    expect(lot.status).toBe('QUARANTINE');
    const sample = await c.prisma.qcSample.findFirstOrThrow({ where: { lotId: ids.lot } });
    expect(sample.status).toBe('REQUESTED');
    ids.rmSample = sample.id;
    const po = await c.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: ids.po } });
    expect(po.status).toBe('RECEIVED');
  });

  it('QA cannot release the lot before QC approval', async () => {
    const r = await (await c.as(U.qaOfficer)).post(`/inventory/lots/${ids.lot}/disposition`, { decision: 'RELEASE', ...sign }).expect(422);
    expect(r.body.error.code).toBe('RELEASE_BLOCKED');
    expect(r.body.error.details.reasons.map((x: { code: string }) => x.code)).toContain('QC_NOT_APPROVED');
  });

  it('QC tests and approves; sampling moved the lot to UNDER_TEST', async () => {
    await runQc(c, ids.rmSample, { 'Identification (IR)': true, Assay: 99.7, 'Loss on drying': 0.2 });
    const s = await c.prisma.qcSample.findUniqueOrThrow({ where: { id: ids.rmSample } });
    expect(s.status).toBe('APPROVED');
    expect(s.conclusion).toBe('PASS');
    expect((await c.prisma.inventoryLot.findUniqueOrThrow({ where: { id: ids.lot } })).status).toBe('UNDER_TEST');
  });

  it('QA releases the lot with an electronic signature', async () => {
    await (await c.as(U.qaOfficer)).post(`/inventory/lots/${ids.lot}/disposition`, { decision: 'RELEASE', ...sign, reason: 'Complies' }).expect(200);
    const lot = await c.prisma.inventoryLot.findUniqueOrThrow({ where: { id: ids.lot } });
    expect(lot.status).toBe('RELEASED');
    const sig = await c.prisma.electronicSignature.findFirst({ where: { entityId: ids.lot, action: 'LOT_QA_RELEASE' } });
    expect(sig?.signerEmail).toBe(U.qaOfficer);
  });

  it('planner creates a batch; FEFO reservation uses only released, earliest-expiring lots', async () => {
    const planner = await c.as(U.planner);
    const product = await c.prisma.product.findFirstOrThrow({ where: { code: 'PCM-500' } });
    const b = await planner.post('/batches', { siteId: ids.site, productId: product.id, plannedStart: days(0), plannedEnd: days(3) }).expect(201);
    ids.batch = b.body.data.id;
    expect(b.body.data.batchNumber).toMatch(/^PCM-\d{4}-\d{6}$/);
    await planner.post(`/batches/${ids.batch}/reserve`).expect(200);
    const res = await c.prisma.materialReservation.findMany({ where: { batchId: ids.batch } });
    const lots = await c.prisma.inventoryLot.findMany({ where: { id: { in: res.map((r) => r.lotId) } } });
    expect(lots.every((l) => l.status === 'RELEASED' && l.expiryDate > new Date())).toBe(true);
    // FEFO: no reserved lot may expire later than a released lot that still had unreserved stock
    const material = await c.prisma.material.findFirstOrThrow({ where: { code: 'EXC-STA-001' } });
    const reservedIds = new Set(res.filter((r) => r.materialId === material.id).map((r) => r.lotId));
    const reserved = lots.filter((l) => reservedIds.has(l.id));
    const others = await c.prisma.inventoryLot.findMany({ where: { materialId: material.id, status: 'RELEASED', id: { notIn: [...reservedIds] } } });
    const latestReserved = Math.max(...reserved.map((l) => l.expiryDate.getTime()));
    for (const o of others.filter((l) => Number(l.quantity) - Number(l.reservedQuantity) > 0)) expect(o.expiryDate.getTime()).toBeGreaterThanOrEqual(latestReserved);
  });

  it('materials are issued, the batch started and every eBMR step signed and verified', async () => {
    await (await c.as(U.warehouseOfficer)).post(`/batches/${ids.batch}/issue-materials`).expect(200);
    await (await c.as(U.supervisor)).post(`/batches/${ids.batch}/start`).expect(200);
    await executeBatch(c, ids.batch, 199000);
    const steps = await c.prisma.batchStep.findMany({ where: { batchId: ids.batch } });
    expect(steps.every((s) => s.status === 'VERIFIED')).toBe(true);
    const cons = await c.prisma.batchMaterialConsumption.findMany({ where: { batchId: ids.batch } });
    expect(cons.length).toBeGreaterThan(0);
  });

  it('completion calculates yield, books FG into QUARANTINE and requests FP QC', async () => {
    const r = await (await c.as(U.productionManager)).post(`/batches/${ids.batch}/complete`, {}).expect(200);
    expect(r.body.data.yield.yieldPct).toBe(99.5);
    const fg = await c.prisma.inventoryLot.findFirstOrThrow({ where: { batchId: ids.batch, itemType: 'PRODUCT' } });
    expect(fg.status).toBe('QUARANTINE');
    ids.fg = fg.id;
    ids.fpSample = (await c.prisma.qcSample.findFirstOrThrow({ where: { batchId: ids.batch, stage: 'FINISHED_PRODUCT' } })).id;
  });

  it('a warehouse user cannot QA-release the batch', async () => {
    await (await c.as(U.warehouseOfficer)).post(`/batches/${ids.batch}/qa-release`, { decision: 'RELEASE', ...sign }).expect(403);
  });

  it('FP QC approval moves the batch to AWAITING_QA; QA releases with e-signature', async () => {
    await runQc(c, ids.fpSample, { Description: true, Assay: 100.2, 'Dissolution (30 min)': 92, 'Disintegration time': 5 }, { analyst: U.qcAnalyst2 });
    expect((await c.prisma.batch.findUniqueOrThrow({ where: { id: ids.batch } })).status).toBe('AWAITING_QA');
    const qa = await c.as(U.qaManager);
    const blockers = await qa.get(`/batches/${ids.batch}/release-blockers`).expect(200);
    expect(blockers.body.data).toEqual([]);
    await qa.post(`/batches/${ids.batch}/qa-release`, { decision: 'RELEASE', ...sign, reason: 'Reviewed' }).expect(200);
    const b = await c.prisma.batch.findUniqueOrThrow({ where: { id: ids.batch } });
    expect(b.status).toBe('RELEASED');
    expect((await c.prisma.inventoryLot.findUniqueOrThrow({ where: { id: ids.fg } })).status).toBe('RELEASED');
  });

  it('finished goods are available; dashboard and audit trail reflect the transactions', async () => {
    const mgmt = await c.as(U.management);
    const avail = await mgmt.get(`/inventory/lots?view=available&batchId=${ids.batch}`).expect(200);
    expect(avail.body.data).toHaveLength(1);
    const auditor = await c.as(U.auditor);
    const events = await auditor.get(`/audit/events?entityId=${ids.batch}&pageSize=200`).expect(200);
    const actions = events.body.data.map((e: { action: string }) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['CREATE', 'STATUS_CHANGE', 'SIGN', 'APPROVE']));
    const verify = await auditor.get('/audit/verify').expect(200);
    expect(verify.body.data.valid).toBe(true);
    const dash = await (await c.as(U.qaManager)).get('/analytics/dashboard').expect(200);
    expect(dash.body.data.charts.releaseCycleTime.some((r: { id: string }) => r.id === ids.batch)).toBe(true);
  });
});
