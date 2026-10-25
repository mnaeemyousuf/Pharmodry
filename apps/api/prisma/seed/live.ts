/*
 * Today's activity, executed through the real application services as specific demo users,
 * so business rules, e-signatures, notifications and the audit trail are all genuine.
 */
import { INestApplicationContext } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import { AuthPrincipal } from '../../src/common/auth-user';
import { CapaService } from '../../src/modules/capa/capa';
import { DeviationsService } from '../../src/modules/deviations/deviations';
import { GrnService } from '../../src/modules/inventory/grn.service';
import { InventoryService } from '../../src/modules/inventory/inventory.service';
import { ScansService } from '../../src/modules/jobs/scans.service';
import { ProcurementService } from '../../src/modules/procurement/procurement';
import { BatchesService } from '../../src/modules/production/batches.service';
import { EbmrService } from '../../src/modules/production/ebmr.service';
import { PlansService } from '../../src/modules/production/plans.service';
import { OosService } from '../../src/modules/quality/oos.service';
import { QcService } from '../../src/modules/quality/qc.service';
import { d, Ids } from './master';

export async function buildPrincipal(prisma: PrismaClient, userId: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
  const grants = new Map<string, Set<string>>();
  for (const ur of u.roles) for (const rp of ur.role.permissions) {
    const s = grants.get(rp.permission.code) ?? new Set<string>();
    s.add(ur.siteId ?? '*');
    grants.set(rp.permission.code, s);
  }
  return new AuthPrincipal(u.id, u.tenantId, u.email, u.fullName, randomUUID(), grants);
}

type Log = (msg: string) => void;

export async function seedLive(app: INestApplicationContext, prisma: PrismaClient, ctx: { tenantId: string; users: Ids; sites: Ids; m: { wh: Ids; bins: Ids; mat: Ids; prod: Ids; eq: Ids; sup: Ids } }, password: string, log: Log) {
  const cls = app.get(ClsService);
  const { users, sites, m } = ctx;
  const KHI = sites.KHI;
  const as = async <T>(key: string, fn: (u: AuthPrincipal) => Promise<T>): Promise<T> => {
    const u = await buildPrincipal(prisma, users[key]);
    return cls.run(async () => {
      cls.set('tenantId', u.tenantId);
      cls.set('userId', u.id);
      cls.set('userEmail', u.email);
      cls.set('userName', u.fullName);
      cls.set('ip', '127.0.0.1');
      cls.set('userAgent', 'pharmodry-demo-seed');
      return fn(u);
    });
  };
  const sign = { password };
  const procurement = app.get(ProcurementService);
  const grns = app.get(GrnService);
  const qc = app.get(QcService);
  const inventory = app.get(InventoryService);
  const plans = app.get(PlansService);
  const batches = app.get(BatchesService);
  const ebmr = app.get(EbmrService);
  const oos = app.get(OosService);
  const deviations = app.get(DeviationsService);
  const capas = app.get(CapaService);
  void capas;

  const sampleFor = (where: { lotId?: string; batchId?: string }) => prisma.qcSample.findFirstOrThrow({ where: { ...where, status: { not: 'CANCELLED' } }, orderBy: { createdAt: 'desc' }, include: { results: true } });
  const testsOf = (specificationId: string) => prisma.qcSpecTest.findMany({ where: { specificationId } });

  const runQc = async (sampleId: string, values: Record<string, number | boolean>, analyst = 'qcAnalyst', approve = true) => {
    const s = await prisma.qcSample.findUniqueOrThrow({ where: { id: sampleId } });
    const tests = await testsOf(s.specificationId);
    await as(analyst, (u) => qc.collect(u, sampleId, { sampleQuantity: s.lotId && s.stage !== 'FINISHED_PRODUCT' ? 0.2 : undefined }));
    const res = await as(analyst, (u) =>
      qc.enterResults(u, sampleId, {
        results: tests.map((t) => {
          const v = values[t.name];
          return t.resultType === 'NUMERIC'
            ? { specTestId: t.id, numericValue: typeof v === 'number' ? v : Number(t.minValue ?? 0) + 1, instrument: t.name.includes('Dissolution') ? 'DT-01' : t.name.includes('Assay') ? 'HPLC-01' : undefined }
            : { specTestId: t.id, passFail: typeof v === 'boolean' ? v : true };
        }),
      }),
    );
    if (!approve) return res;
    await as(analyst, (u) => qc.submit(u, sampleId));
    await as('qcManager', (u) => qc.review(u, sampleId, { decision: 'ACCEPT' }));
    await as('qcManager', (u) => qc.approve(u, sampleId, { ...sign, reason: 'Results verified against specification' }));
    return res;
  };

  const eqFor: Record<string, string> = { BALANCE: 'BAL-01', GRANULATOR: 'RMG-01', DRYER: 'FBD-01', TABLET_PRESS: 'TP-01', BLISTER: 'BLS-01', ENCAPSULATOR: 'ENC-01', BLENDER: 'BLD-01' };
  const mid = (p: { min?: number; max?: number }) => Math.round(((p.min ?? 0) + (p.max ?? (p.min ?? 0) + 2)) * 50) / 100;

  /** Executes eBMR steps (operator) and verification (supervisor). `upTo` limits how many steps. */
  const execute = async (batchId: string, output: number, upTo?: number, consumptionFactor = 0.998) => {
    const steps = await prisma.batchStep.findMany({ where: { batchId }, orderBy: { sequence: 'asc' } });
    for (const [i, st] of steps.entries()) {
      if (upTo !== undefined && i >= upTo) break;
      await as('operator', (u) => ebmr.startStep(u, batchId, st.id, { equipmentId: st.equipmentType ? m.eq[eqFor[st.equipmentType]] : undefined }));
      const params = (st.parameterDefs as { code: string; min?: number; max?: number }[]) ?? [];
      const ipcs = (st.ipcDefs as { code: string; min?: number; max?: number }[]) ?? [];
      const reservations = st.consumesMaterials ? await prisma.materialReservation.findMany({ where: { batchId, status: 'ISSUED' } }) : [];
      const byLot = new Map<string, number>();
      reservations.forEach((r) => byLot.set(r.lotId, (byLot.get(r.lotId) ?? 0) + Number(r.quantity)));
      await as('operator', (u) =>
        ebmr.completeStep(u, batchId, st.id, {
          ...sign,
          readings: Object.fromEntries(params.map((p) => [p.code, mid(p)])),
          ipcResults: Object.fromEntries(ipcs.map((p) => [p.code, p.max === 0 ? 0 : mid(p)])),
          consumptions: st.consumesMaterials ? [...byLot.entries()].map(([lotId, q]) => ({ lotId, actualQuantity: Math.round(q * consumptionFactor * 1000) / 1000 })) : undefined,
          outputQuantity: st.recordsOutput ? output : undefined,
          remarks: st.consumesMaterials ? 'All lots verified RELEASED; weights printed and attached.' : undefined,
        }),
      );
      await as('supervisor', (u) => ebmr.verifyStep(u, batchId, st.id, sign));
    }
  };

  // ── Scenario A: receive → QC → QA release → manufacture → QC → QA release
  const po = await as('procurementOfficer', (u) =>
    procurement.create(u, { siteId: KHI, supplierId: m.sup['SUP-001'], expectedDate: d(2).toISOString(), notes: 'Paracetamol API replenishment', lines: [{ materialId: m.mat['API-PCM-001'], quantity: 500, unitPrice: 1250 }] }),
  );
  await as('procurementManager', (u) => procurement.approve(u, po.id));
  const grn = await as('warehouseOfficer', (u) =>
    grns.create(u, {
      siteId: KHI,
      supplierId: m.sup['SUP-001'],
      purchaseOrderId: po.id,
      deliveryNote: 'DN-MPC-77812',
      lines: [{ materialId: m.mat['API-PCM-001'], poLineId: po.lines[0].id, supplierBatch: 'MPC-PCM-26-0981', quantity: 500, containers: 20, mfgDate: d(-45).toISOString(), expiryDate: d(1050).toISOString(), warehouseId: m.wh['WH-RM'], binId: m.bins['WH-RM/A-02'] }],
    }),
  );
  const grnLine = await prisma.goodsReceiptLine.findFirstOrThrow({ where: { goodsReceiptId: grn.id } });
  log(`A: ${grn.number} received lot ${grn.lots[0].lotNumber} into QUARANTINE`);
  const rmSample = await sampleFor({ lotId: grnLine.lotId });
  await runQc(rmSample.id, { 'Identification (IR)': true, Assay: 99.6, 'Loss on drying': 0.21 });
  await as('qaOfficer', (u) => inventory.disposition(u, grnLine.lotId, { decision: 'RELEASE', ...sign, reason: 'CoA and QC results reviewed; complies.' }));
  log('A: Paracetamol API lot released by QA (e-signature)');

  const plan = await as('planner', (u) =>
    plans.create(u, {
      siteId: KHI,
      name: `Production plan ${new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}`,
      periodStart: d(-10).toISOString(),
      periodEnd: d(20).toISOString(),
      lines: [
        { productId: m.prod.PCM, plannedQuantity: 600000, plannedBatches: 3, demandQuantity: 560000 },
        { productId: m.prod.AMX, plannedQuantity: 200000, plannedBatches: 2, demandQuantity: 220000 },
        { productId: m.prod.OMZ, plannedQuantity: 100000, plannedBatches: 1, demandQuantity: 95000 },
      ],
    }),
  );
  await as('productionManager', (u) => plans.approve(u, plan.id));
  const lineOf = (pid: string) => plan.lines.find((l) => l.productId === pid)!.id;

  const batchA = await as('planner', (u) => batches.create(u, { siteId: KHI, productId: m.prod.PCM, planLineId: lineOf(m.prod.PCM), plannedStart: d(-1).toISOString(), plannedEnd: d(2).toISOString() }));
  await as('planner', (u) => batches.reserve(u, batchA.id));
  await as('warehouseOfficer', (u) => batches.issue(u, batchA.id));
  await as('supervisor', (u) => batches.start(u, batchA.id));
  await execute(batchA.id, 198400);
  await as('productionManager', (u) => batches.complete(u, batchA.id, {}));
  const fpA = await sampleFor({ batchId: batchA.id });
  await runQc(fpA.id, { Description: true, Assay: 100.4, 'Dissolution (30 min)': 91.2, 'Disintegration time': 6.5 }, 'qcAnalyst2');
  await as('qaManager', (u) => batches.qaDecision(u, batchA.id, { decision: 'RELEASE', ...sign, reason: 'Batch record, deviations and QC results reviewed. Released.' }));
  log(`A: batch ${batchA.batchNumber} RELEASED`);

  // ── Scenario B: failed dissolution → OOS → release blocked → investigation + deviation
  const batchB = await as('planner', (u) => batches.create(u, { siteId: KHI, productId: m.prod.PCM, planLineId: lineOf(m.prod.PCM), plannedStart: d(-1).toISOString(), plannedEnd: d(3).toISOString() }));
  await as('planner', (u) => batches.reserve(u, batchB.id));
  await as('warehouseOfficer', (u) => batches.issue(u, batchB.id));
  await as('supervisor', (u) => batches.start(u, batchB.id));
  await execute(batchB.id, 197100);
  await as('productionManager', (u) => batches.complete(u, batchB.id, {}));
  const fpB = await sampleFor({ batchId: batchB.id });
  const flagged = (await runQc(fpB.id, { Description: true, Assay: 99.1, 'Dissolution (30 min)': 74, 'Disintegration time': 13.5 }, 'qcAnalyst', false)) as { flaggedOosCandidates: { id: string; number: string }[] };
  const oosId = flagged.flaggedOosCandidates[0].id;
  log(`B: dissolution 74 % flagged → ${flagged.flaggedOosCandidates[0].number} opened`);
  await as('qcAnalyst', (u) => qc.submit(u, fpB.id));
  try {
    await as('qaManager', (u) => batches.qaDecision(u, batchB.id, { decision: 'RELEASE', ...sign }));
    throw new Error('QA release unexpectedly succeeded for OOS batch');
  } catch (e) {
    log(`B: QA release correctly blocked — ${(e as Error).message}`);
  }
  await as('qaOfficer', (u) => oos.advance(u, oosId, { ownerId: users.qaOfficer }));
  await as('qaOfficer', (u) => oos.advance(u, oosId, { preliminaryFindings: 'Analyst calculations, dilution factors and sample weights checked — no errors found. Instrument logbook reviewed.' }));
  await as('qaOfficer', (u) => oos.advance(u, oosId, { labInvestigation: 'Dissolution media pH, deaeration, paddle height and standard preparation verified. Re-measurement of original solutions confirmed 73.8–74.4 %. No assignable laboratory error.', assignableLabError: false }));
  const dev = await as('supervisor', (u) =>
    deviations.create(u, {
      siteId: KHI,
      title: `Dissolution OOS on Paracetamol batch ${batchB.batchNumber}`,
      description: 'Finished product dissolution at 30 min was 74 % against specification ≥ 80 %. Compression hardness at upper end of range observed during IPC.',
      immediateAction: 'Batch held in quarantine; QA informed; OOS investigation opened.',
      occurredAt: new Date().toISOString(),
      category: 'COMPRESSION',
      proposedSeverity: 'MAJOR',
      productId: m.prod.PCM,
      batchId: batchB.id,
      equipmentId: m.eq['TP-01'],
      oosId,
      submit: true,
    }),
  );
  await as('qaManager', (u) => deviations.startReview(u, dev.id));
  await as('qaManager', (u) => deviations.classify(u, dev.id, { classification: 'MAJOR', ownerId: users.qaOfficer, qaReviewNotes: 'Potential product impact; linked to OOS investigation. Manufacturing investigation to focus on compression force and granule moisture.' }));
  log(`B: deviation ${dev.number} linked, classified MAJOR, in investigation`);

  // ── Scenario C: Amoxicillin batch cannot be reserved (API shortage) — demonstrates FEFO/shortage control
  const poAmx = await as('procurementOfficer', (u) => procurement.create(u, { siteId: KHI, supplierId: m.sup['SUP-002'], expectedDate: d(35).toISOString(), notes: 'Urgent: AMX API shortage', lines: [{ materialId: m.mat['API-AMX-001'], quantity: 200, unitPrice: 9800 }] }));
  await as('procurementManager', (u) => procurement.approve(u, poAmx.id));
  const batchC = await as('planner', (u) => batches.create(u, { siteId: KHI, productId: m.prod.AMX, planLineId: lineOf(m.prod.AMX), plannedStart: d(-2).toISOString(), plannedEnd: d(1).toISOString() }));
  try {
    await as('planner', (u) => batches.reserve(u, batchC.id));
  } catch (e) {
    log(`C: ${batchC.batchNumber} reservation blocked — ${(e as Error).message}`);
  }

  // ── Scenario D: Omeprazole batch in progress (for operator demo)
  const batchD = await as('planner', (u) => batches.create(u, { siteId: KHI, productId: m.prod.OMZ, planLineId: lineOf(m.prod.OMZ), plannedStart: d(0).toISOString(), plannedEnd: d(3).toISOString() }));
  await as('planner', (u) => batches.reserve(u, batchD.id));
  await as('warehouseOfficer', (u) => batches.issue(u, batchD.id));
  await as('supervisor', (u) => batches.start(u, batchD.id));
  await execute(batchD.id, 0, 1);
  log(`D: ${batchD.batchNumber} in progress (dispensing complete)`);

  // ── Scenario E: material received today, awaiting QC (for live demo)
  const grnE = await as('warehouseOfficer', (u) =>
    grns.create(u, {
      siteId: KHI,
      supplierId: m.sup['SUP-003'],
      deliveryNote: 'DN-LEX-5521',
      lines: [{ materialId: m.mat['EXC-MCC-101'], supplierBatch: 'LEX-MCC-2611', quantity: 100, containers: 4, mfgDate: d(-30).toISOString(), expiryDate: d(700).toISOString(), warehouseId: m.wh['WH-RM'], binId: m.bins['WH-RM/B-01'] }],
    }),
  );
  log(`E: ${grnE.number} received, awaiting QC`);
  // ── Planned PCM batch #3 (not yet reserved)
  await as('planner', (u) => batches.create(u, { siteId: KHI, productId: m.prod.PCM, planLineId: lineOf(m.prod.PCM), plannedStart: d(4).toISOString(), plannedEnd: d(7).toISOString() }));

  const scans = await app.get(ScansService).run(ctx.tenantId);
  log(`Scans: ${JSON.stringify(scans)}`);
  return { batchA: batchA.batchNumber, batchB: batchB.batchNumber, batchC: batchC.batchNumber, batchD: batchD.batchNumber };
}
