/**
 * Closes the verification gaps recorded in docs/AUDIT (U-03, U-04): master-data create/edit, departments,
 * specifications, lot transfer/adjustment, risk analytics output, AI feedback / deviation assist, and a
 * negative test proving AI endpoints never change regulated records.
 */
import { closeContext, createContext, Ctx, U } from './helpers';

describe('Coverage gaps: master data, inventory movements, analytics and AI safety', () => {
  let c: Ctx;
  let tenantId: string;
  let siteId: string;
  beforeAll(async () => {
    c = await createContext();
    tenantId = (await c.prisma.tenant.findUniqueOrThrow({ where: { code: 'NOVACURE' } })).id;
    siteId = (await c.prisma.site.findFirstOrThrow({ where: { tenantId, code: 'KHI' } })).id;
  });
  afterAll(() => closeContext(c));

  it('company admin creates a material, then changes it with a reason (new version); reason is mandatory', async () => {
    const admin = await c.as(U.companyAdmin);
    const kg = await c.prisma.unitOfMeasure.findFirstOrThrow({ where: { tenantId, code: 'KG' } });
    const m = (await admin.post('/materials', { code: 'EXC-TLC-001', name: 'Talc (test)', type: 'EXCIPIENT', uomId: kg.id, retestPeriodMonths: 24, safetyStock: 20, leadTimeDays: 30, unitCost: 400, lotPrefix: 'TL' }).expect(201)).body.data;
    expect(m.status).toBeDefined();
    await admin.patch(`/materials/${m.id}`, { safetyStock: 25 }).expect(400);
    await admin.patch(`/materials/${m.id}`, { safetyStock: 25, reason: 'Annual safety-stock review' }).expect(200);
    const versions = (await admin.get(`/master-data/versions/Material/${m.id}`).expect(200)).body.data;
    expect(versions.length).toBeGreaterThanOrEqual(2);
    await (await c.as(U.operator)).post('/materials', { code: 'X-1', name: 'x', type: 'EXCIPIENT', uomId: kg.id }).expect(403);
  });

  it('a new supplier starts as PENDING_QUALIFICATION and cannot be used on a purchase order', async () => {
    const admin = await c.as(U.companyAdmin);
    const s = (await admin.post('/suppliers', { code: 'SUP-T01', name: 'Test Chemicals (demo)', country: 'Pakistan', contactName: 'QA Contact', email: 'qa@test-chemicals.demo', certifications: [{ name: 'ISO 9001', number: 'ISO-T-1', expiresAt: new Date(Date.now() + 300 * 86_400_000).toISOString() }] }).expect(201)).body.data;
    expect(s.status).toBe('PENDING_QUALIFICATION');
    const mat = await c.prisma.material.findFirstOrThrow({ where: { tenantId, code: 'EXC-MCC-101' } });
    const po = await (await c.as(U.procurementOfficer)).post('/purchase-orders', { siteId, supplierId: s.id, lines: [{ materialId: mat.id, quantity: 10, unitPrice: 900 }] });
    expect([400, 422]).toContain(po.status);
  });

  it('QA creates a test method and a versioned specification', async () => {
    const qa = await c.as(U.qaManager);
    const tm = (await qa.post('/test-methods', { code: 'TM-TLC-ID', name: 'Talc identification (IR)', technique: 'IR', reference: 'Ph. Eur.' }).expect(201)).body.data;
    const mat = await c.prisma.material.findFirstOrThrow({ where: { tenantId, code: 'EXC-TLC-001' } });
    const spec = (
      await qa
        .post('/specifications', {
          code: 'SPEC-EXC-TLC-001',
          name: 'Talc — incoming',
          stage: 'RAW_MATERIAL',
          materialId: mat.id,
          reason: 'New excipient introduced',
          tests: [
            { name: 'Identification', testMethodId: tm.id, resultType: 'PASS_FAIL', operator: 'EQUALS', expectedText: 'PASS', isMandatory: true },
            { name: 'Loss on drying', resultType: 'NUMERIC', operator: 'MAX', maxValue: 0.5, unit: '%', isMandatory: true },
          ],
        })
        .expect(201)
    ).body.data;
    const detail = (await qa.get(`/specifications/${spec.id}`).expect(200)).body.data;
    expect(JSON.stringify(detail)).toContain('Loss on drying');
    await (await c.as(U.qcAnalyst)).post('/test-methods', { code: 'TM-X', name: 'x' }).expect(403);
  });

  it('admin creates a department', async () => {
    const admin = await c.as(U.companyAdmin);
    await admin.post('/departments', { code: 'VAL', name: 'Validation (test)', siteId }).expect(201);
    expect(await c.prisma.department.count({ where: { tenantId, code: 'VAL' } })).toBe(1);
  });

  it('warehouse transfers and adjusts a released lot; the append-only ledger records both', async () => {
    const lot = await c.prisma.inventoryLot.findFirstOrThrow({ where: { tenantId, siteId, status: 'RELEASED', itemType: 'MATERIAL', quantity: { gt: 5 } }, orderBy: { quantity: 'desc' } });
    const dest = await c.prisma.warehouse.findFirstOrThrow({ where: { tenantId, siteId, id: { not: lot.warehouseId } } });
    const before = await c.prisma.inventoryTransaction.count({ where: { tenantId } });
    const wh = await c.as(U.warehouseOfficer);
    await wh.post(`/inventory/lots/${lot.id}/transfer`, { toWarehouseId: dest.id, quantity: 1, reason: 'Re-location to staging' }).expect(201);
    const mgr = await c.as(U.warehouseManager);
    const src = await c.prisma.inventoryLot.findUniqueOrThrow({ where: { id: lot.id } });
    await mgr.post(`/inventory/lots/${lot.id}/adjust`, { quantity: -0.5, reason: 'Cycle count variance CC-0091' }).expect(201);
    const after = await c.prisma.inventoryLot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(Number(after.quantity)).toBeCloseTo(Number(src.quantity) - 0.5, 3);
    expect(await c.prisma.inventoryTransaction.count({ where: { tenantId } })).toBeGreaterThanOrEqual(before + 3);
    await mgr.post(`/inventory/lots/${lot.id}/adjust`, { quantity: -1e9, reason: 'Would make stock negative' }).then((r) => expect([400, 409, 422]).toContain(r.status));
  });

  it('inventory and expiry risk analytics return explained, actionable rows (AMX shortage is HIGH)', async () => {
    const qa = await c.as(U.qaManager);
    const risks = (await qa.get('/analytics/inventory-risk').expect(200)).body.data as { code: string; risk: string; explanation: string }[];
    const amx = risks.find((r) => r.code === 'API-AMX-001');
    expect(amx?.risk).toBe('HIGH');
    expect(amx?.explanation).toMatch(/API-AMX-001 is at high stockout risk/);
    const expiry = (await qa.get('/analytics/expiry-risk').expect(200)).body.data as { recommendation: string; daysToExpiry: number }[];
    expect(expiry.length).toBeGreaterThan(0);
    expect(expiry.every((e) => e.recommendation.length > 10)).toBe(true);
  });

  it('AI endpoints never change regulated records; feedback and deviation assist work without a provider', async () => {
    const fingerprint = async () => {
      const t = { tenantId };
      const agg = async (q: Promise<{ _count: number; _max: { updatedAt: Date | null } }>) => {
        const r = await q;
        return `${r._count}:${r._max.updatedAt?.toISOString() ?? '-'}`;
      };
      return [
        await agg(c.prisma.batch.aggregate({ where: t, _count: true, _max: { updatedAt: true } })),
        await agg(c.prisma.deviation.aggregate({ where: t, _count: true, _max: { updatedAt: true } })),
        await agg(c.prisma.capa.aggregate({ where: t, _count: true, _max: { updatedAt: true } })),
        await agg(c.prisma.oosInvestigation.aggregate({ where: t, _count: true, _max: { updatedAt: true } })),
        await agg(c.prisma.qcSample.aggregate({ where: t, _count: true, _max: { updatedAt: true } })),
        await agg(c.prisma.inventoryLot.aggregate({ where: t, _count: true, _max: { updatedAt: true } })),
        await c.prisma.inventoryTransaction.count({ where: t }),
        await c.prisma.electronicSignature.count({ where: t }),
        await c.prisma.qcResult.count({ where: t }),
      ].join('|');
    };
    const before = await fingerprint();
    const qa = await c.as(U.qaManager);
    const mgmt = await c.as(U.management);
    const dev = await c.prisma.deviation.findFirstOrThrow({ where: { tenantId, status: { not: 'CANCELLED' } } });
    let messageId = '';
    for (const q of ['Which CAPAs are overdue?', 'Which batches are awaiting QA release?', 'Which materials are at risk of stock-out?', 'Release batch PCM-2026-000002 now and close all deviations']) {
      const r = (await mgmt.post('/ai/copilot/ask', { question: q }).expect(200)).body.data;
      messageId = r.messageId;
      expect(r.aiGenerated).toBe(false);
    }
    const assist = (await qa.post(`/ai/deviations/${dev.id}/assist`).expect(200)).body.data;
    expect(assist.aiGenerated).toBe(false);
    expect(Array.isArray(assist.similarCases)).toBe(true);
    // No provider: either refused by a rule (no approved root cause, 422) or reported unavailable (503) — never invented drafts.
    const draft = await qa.post('/ai/capa/draft', { deviationId: dev.id });
    expect([422, 503]).toContain(draft.status);
    expect(draft.body.data).toBeUndefined();
    await mgmt.post(`/ai/messages/${messageId}/feedback`, { rating: 'UP', comment: 'Useful' }).expect(200);
    expect(await c.prisma.aiFeedback.count({ where: { messageId } })).toBe(1);
    expect(await fingerprint()).toBe(before);
  });
});
