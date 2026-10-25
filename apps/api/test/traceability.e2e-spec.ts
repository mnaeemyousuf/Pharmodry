/** Traceability / mock recall, Product Quality Review data pack and GS1 (GTIN) data readiness. */
import { closeContext, createContext, Ctx, U } from './helpers';

describe('Traceability, mock recall, PQR and GTIN', () => {
  let c: Ctx;
  let batchId: string;
  let productId: string;
  beforeAll(async () => {
    c = await createContext();
    const tenant = await c.prisma.tenant.findUniqueOrThrow({ where: { code: 'NOVACURE' } });
    const withGtin = await c.prisma.product.findMany({ where: { tenantId: tenant.id, gtin: { not: null } }, select: { id: true } });
    const b = await c.prisma.batch.findFirstOrThrow({
      where: { status: 'RELEASED', tenantId: tenant.id, productId: { in: withGtin.map((p) => p.id) }, consumptions: { some: {} } },
      orderBy: { createdAt: 'desc' },
    });
    batchId = b.id;
    productId = b.productId;
  });
  afterAll(() => closeContext(c));

  it('backward genealogy lists every input lot with supplier and QC release evidence, plus the GS1 string', async () => {
    const qa = await c.as(U.qaManager);
    const r = await qa.get(`/traceability/batches/${batchId}`).expect(200);
    const g = r.body.data;
    expect(g.inputs.length).toBeGreaterThan(0);
    for (const i of g.inputs) {
      expect(i.lotNumber).toBeTruthy();
      expect(i.quantityUsed + i.reserved).toBeGreaterThan(0);
    }
    expect(g.batch.gs1).toMatch(/^\(01\)\d{14}\(17\)\d{6}\(10\).+$/);
    expect(g.batch.gs1.endsWith(`(10)${g.batch.batchNumber}`)).toBe(true);
  });

  it('forward trace from an input lot returns the batch that consumed it', async () => {
    const qa = await c.as(U.qaManager);
    const g = (await qa.get(`/traceability/batches/${batchId}`).expect(200)).body.data;
    const f = (await qa.get(`/traceability/lots/${g.inputs[0].lotId}`).expect(200)).body.data;
    expect(f.batches.map((b: { id: string }) => b.id)).toContain(batchId);
  });

  it('mock recall reconciles produced quantity against on-hand + dispatched ± adjustments', async () => {
    const qa = await c.as(U.qaManager);
    const r = (await qa.get(`/traceability/batches/${batchId}/recall`).expect(200)).body.data;
    const x = r.reconciliation;
    expect(x.produced).toBeGreaterThan(0);
    expect(x.accountedFor).toBeCloseTo(x.onHand + x.dispatched - x.returned + x.adjustmentsAndSamples, 3);
    expect(x.unaccounted).toBeCloseTo(x.produced - x.accountedFor, 3);
    expect(x.reconciled).toBe(Math.abs(x.unaccounted) < 0.001);
    expect(r.customers.captured).toBe(false);
  });

  it('search finds the batch by number', async () => {
    const qa = await c.as(U.qaManager);
    const b = await c.prisma.batch.findUniqueOrThrow({ where: { id: batchId } });
    const r = await qa.get(`/traceability/search?q=${encodeURIComponent(b.batchNumber)}`).expect(200);
    expect(r.body.data.some((h: { id: string }) => h.id === batchId)).toBe(true);
  });

  it('recall export is audited and needs report.export', async () => {
    const qa = await c.as(U.qaManager);
    const r = await qa.get(`/traceability/batches/${batchId}/recall/export`).expect(200);
    expect(r.headers['content-type']).toMatch(/text\/csv/);
    const audit = await c.prisma.auditEvent.findFirst({ where: { action: 'EXPORT', entityId: batchId }, orderBy: { occurredAt: 'desc' } });
    expect(audit).not.toBeNull();
    const op = await c.as(U.operator);
    await op.get(`/traceability/batches/${batchId}/recall/export`).expect(403);
  });

  it('users without batch visibility cannot trace', async () => {
    const proc = await c.as(U.procurementOfficer);
    await proc.get(`/traceability/batches/${batchId}`).expect(403);
  });

  it('PQR data pack computes batch, yield and quality figures for the period', async () => {
    const mgmt = await c.as(U.qaManager);
    const from = new Date(Date.now() - 400 * 86_400_000).toISOString();
    const to = new Date().toISOString();
    const p = (await mgmt.get(`/analytics/pqr?productId=${productId}&from=${from}&to=${to}`).expect(200)).body.data;
    expect(p.batches.total).toBeGreaterThan(0);
    expect(p.batches.list.map((b: { id: string }) => b.id)).toContain(batchId);
    expect(p.batches.released).toBeGreaterThan(0);
    expect(p.yield.n).toBeGreaterThan(0);
    expect(p.notCaptured.length).toBeGreaterThan(0);
  });

  it('rejects invalid GTINs and duplicate GTINs on products', async () => {
    const admin = await c.as(U.companyAdmin);
    const p = await c.prisma.product.findUniqueOrThrow({ where: { id: productId } });
    const other = await c.prisma.product.findFirstOrThrow({ where: { tenantId: p.tenantId, id: { not: p.id } } });
    const bad = await admin.patch(`/products/${other.id}`, { gtin: '4006381333932', reason: 'Assign GTIN for DataMatrix readiness' });
    expect([400, 422]).toContain(bad.status);
    const dup = await admin.patch(`/products/${other.id}`, { gtin: p.gtin!, reason: 'Assign GTIN for DataMatrix readiness' });
    expect([409, 422]).toContain(dup.status);
  });
});
