/**
 * Demo scenario 2 — failed QC: dissolution 74 % vs ≥ 80 % → OOS candidate → release blocked →
 * investigation phases → deviation linked → root cause → CAPA → QA conclusion (e-sign) → batch rejected.
 */
import { closeContext, createContext, Ctx, days, executeBatch, runQc, sign, U } from './helpers';

describe('Scenario B — failed QC result and OOS investigation', () => {
  let c: Ctx;
  const ids: Record<string, string> = {};
  beforeAll(async () => {
    c = await createContext();
    const planner = await c.as(U.planner);
    const site = await c.prisma.site.findFirstOrThrow({ where: { code: 'KHI' } });
    const product = await c.prisma.product.findFirstOrThrow({ where: { code: 'PCM-500' } });
    ids.site = site.id;
    const b = await planner.post('/batches', { siteId: site.id, productId: product.id, plannedStart: days(0), plannedEnd: days(3) }).expect(201);
    ids.batch = b.body.data.id;
    await planner.post(`/batches/${ids.batch}/reserve`).expect(200);
    await (await c.as(U.warehouseOfficer)).post(`/batches/${ids.batch}/issue-materials`).expect(200);
    await (await c.as(U.supervisor)).post(`/batches/${ids.batch}/start`).expect(200);
    await executeBatch(c, ids.batch, 197600);
    await (await c.as(U.productionManager)).post(`/batches/${ids.batch}/complete`, {}).expect(200);
    ids.sample = (await c.prisma.qcSample.findFirstOrThrow({ where: { batchId: ids.batch, stage: 'FINISHED_PRODUCT' } })).id;
  });
  afterAll(() => closeContext(c));

  it('flags dissolution 74 % as an OOS candidate and opens an investigation automatically', async () => {
    const { flagged } = await runQc(c, ids.sample, { Description: true, Assay: 99.4, 'Dissolution (30 min)': 74, 'Disintegration time': 12 }, { approve: false });
    expect(flagged).toHaveLength(1);
    ids.oos = flagged[0].id;
    const oos = await c.prisma.oosInvestigation.findUniqueOrThrow({ where: { id: ids.oos } });
    expect(oos.status).toBe('REPORTED');
    expect(oos.conclusion).toBeNull(); // the system never decides the regulatory conclusion
    expect(oos.actualResult).toBe('74 %');
    const result = await c.prisma.qcResult.findFirstOrThrow({ where: { id: oos.qcResultId } });
    expect(result.evaluation).toBe('OOS_CANDIDATE');
  });

  it('blocks QC approval and QA release while the OOS is open', async () => {
    const analyst = await c.as(U.qcAnalyst);
    await analyst.post(`/qc/samples/${ids.sample}/submit`).expect(200);
    const qcm = await c.as(U.qcManager);
    await qcm.post(`/qc/samples/${ids.sample}/review`, { decision: 'ACCEPT' }).expect(200);
    const approve = await qcm.post(`/qc/samples/${ids.sample}/approve`, sign).expect(422);
    expect(approve.body.error.code).toBe('OOS_BLOCKING');
    const qa = await c.as(U.qaManager);
    const rel = await qa.post(`/batches/${ids.batch}/qa-release`, { decision: 'RELEASE', ...sign });
    expect([409, 422]).toContain(rel.status);
    expect((await c.prisma.batch.findUniqueOrThrow({ where: { id: ids.batch } })).status).toBe('AWAITING_QC');
    const blockers = await qa.get(`/batches/${ids.batch}/release-blockers`).expect(200);
    expect(blockers.body.data.map((r: { code: string }) => r.code)).toEqual(expect.arrayContaining(['OOS', 'QC_PENDING']));
  });

  it('cannot replace the flagged result while the investigation is open', async () => {
    const t = await c.prisma.qcSpecTest.findFirstOrThrow({ where: { name: 'Dissolution (30 min)', specification: { productId: { not: null } } } });
    const r = await (await c.as(U.qcAnalyst)).post(`/qc/samples/${ids.sample}/results`, { results: [{ specTestId: t.id, numericValue: 85, correctionReason: 'Retest' }] });
    expect([409, 422]).toContain(r.status);
  });

  it('investigator records each phase; phases cannot be skipped', async () => {
    const qo = await c.as(U.qaOfficer);
    await qo.post(`/oos/${ids.oos}/advance`, { ownerId: (await c.prisma.user.findFirstOrThrow({ where: { email: U.qaOfficer } })).id }).expect(200);
    await qo.post(`/oos/${ids.oos}/advance`, {}).expect(400); // findings required
    await qo.post(`/oos/${ids.oos}/advance`, { preliminaryFindings: 'Calculations and sample preparation verified; no obvious error.' }).expect(200);
    await qo.post(`/oos/${ids.oos}/advance`, { labInvestigation: 'Apparatus, media and standards verified; original solutions re-measured 73.9 %.', assignableLabError: false }).expect(200);
  });

  it('a deviation is raised and linked to the OOS and batch', async () => {
    const d = await (await c.as(U.supervisor))
      .post('/deviations', {
        siteId: ids.site,
        title: 'Dissolution OOS — compression hardness at upper limit',
        description: 'FP dissolution 74 % vs ≥ 80 %. Hardness trended high during compression IPC.',
        immediateAction: 'Batch held; QA informed.',
        occurredAt: new Date().toISOString(),
        category: 'COMPRESSION',
        batchId: ids.batch,
        oosId: ids.oos,
        submit: true,
      })
      .expect(201);
    ids.dev = d.body.data.id;
    const oos = await c.prisma.oosInvestigation.findUniqueOrThrow({ where: { id: ids.oos } });
    expect(oos.deviationId).toBe(ids.dev);
    const qa = await c.as(U.qaManager);
    await qa.post(`/deviations/${ids.dev}/start-review`).expect(200);
    const owner = await c.prisma.user.findFirstOrThrow({ where: { email: U.qaOfficer } });
    await qa.post(`/deviations/${ids.dev}/classify`, { classification: 'MAJOR', ownerId: owner.id, qaReviewNotes: 'Linked to OOS; product impact possible.' }).expect(200);
  });

  it('root cause is documented and a CAPA generated from the OOS', async () => {
    const qo = await c.as(U.qaOfficer);
    await qo.post(`/oos/${ids.oos}/advance`, { manufacturingInvestigation: 'Compression force set at upper range; hardness 11.5 kp average.' }).expect(200);
    await qo.post(`/oos/${ids.oos}/advance`, { rootCause: 'Excessive compression force produced harder tablets with slower dissolution.' }).expect(200);
    await qo.post(`/oos/${ids.oos}/advance`, { impactAssessment: 'Batch affected only; other batches compressed within range.' }).expect(200);
    // CAPA phase requires a CAPA or justification
    await qo.post(`/oos/${ids.oos}/advance`, {}).expect(422);
    const owner = await c.prisma.user.findFirstOrThrow({ where: { email: U.engineering } });
    const capa = await qo
      .post('/capas', {
        siteId: ids.site,
        source: 'OOS',
        oosId: ids.oos,
        deviationId: ids.dev,
        problemStatement: 'Dissolution OOS caused by excessive compression force',
        rootCause: 'Compression force at upper range',
        priority: 'HIGH',
        ownerId: owner.id,
        dueDate: days(30),
        actions: [{ type: 'CORRECTIVE', description: 'Narrow compression force range in master eBMR', ownerId: owner.id, dueDate: days(10) }],
      })
      .expect(201);
    ids.capa = capa.body.data.id;
    await qo.post(`/oos/${ids.oos}/advance`, {}).expect(200);
    expect((await c.prisma.oosInvestigation.findUniqueOrThrow({ where: { id: ids.oos } })).status).toBe('QA_APPROVAL');
  });

  it('QA concludes CONFIRMED_OOS with e-signature; invalidation is refused without a lab error; owner cannot self-approve', async () => {
    const qa = await c.as(U.qaManager);
    const inval = await qa.post(`/oos/${ids.oos}/qa-approve`, { conclusion: 'INVALIDATED_LAB_ERROR', ...sign, reason: 'attempt' }).expect(422);
    expect(inval.body.error.message).toMatch(/assignable laboratory error/);
    await (await c.as(U.qaOfficer)).post(`/oos/${ids.oos}/qa-approve`, { conclusion: 'CONFIRMED_OOS', ...sign, reason: 'x' }).expect(403);
    await qa.post(`/oos/${ids.oos}/qa-approve`, { conclusion: 'CONFIRMED_OOS', ...sign, reason: 'Investigation confirms a true OOS.' }).expect(200);
    const oos = await c.prisma.oosInvestigation.findUniqueOrThrow({ where: { id: ids.oos } });
    expect(oos.status).toBe('CLOSED');
    expect(oos.conclusion).toBe('CONFIRMED_OOS');
  });

  it('QC approval now concludes FAIL; QA release stays blocked; QA rejects the batch', async () => {
    await (await c.as(U.qcManager)).post(`/qc/samples/${ids.sample}/approve`, sign).expect(200);
    const s = await c.prisma.qcSample.findUniqueOrThrow({ where: { id: ids.sample } });
    expect(s.conclusion).toBe('FAIL');
    expect((await c.prisma.batch.findUniqueOrThrow({ where: { id: ids.batch } })).status).toBe('AWAITING_QA');
    const qa = await c.as(U.qaManager);
    const rel = await qa.post(`/batches/${ids.batch}/qa-release`, { decision: 'RELEASE', ...sign }).expect(422);
    expect(rel.body.error.details.reasons.map((r: { code: string }) => r.code)).toEqual(expect.arrayContaining(['QC_FAILED', 'OOS', 'OPEN_DEVIATION']));
    await qa.post(`/batches/${ids.batch}/qa-release`, { decision: 'REJECT', ...sign, reason: 'Confirmed dissolution OOS (see OOS and deviation).' }).expect(200);
    expect((await c.prisma.batch.findUniqueOrThrow({ where: { id: ids.batch } })).status).toBe('REJECTED');
    const fg = await c.prisma.inventoryLot.findFirstOrThrow({ where: { batchId: ids.batch, itemType: 'PRODUCT' } });
    expect(fg.status).toBe('REJECTED');
  });

  it('every step is in the audit trail and the dashboard counts the OOS', async () => {
    const auditor = await c.as(U.auditor);
    const ev = await auditor.get(`/audit/events?entityId=${ids.oos}&pageSize=100`).expect(200);
    expect(ev.body.data.length).toBeGreaterThanOrEqual(8);
    const dash = await (await c.as(U.management)).get('/analytics/dashboard').expect(200);
    const month = dash.body.data.charts.oosTrend.at(-1);
    expect(month.confirmed).toBeGreaterThanOrEqual(1);
  });
});
