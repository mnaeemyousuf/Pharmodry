/*
 * Six months of legacy history (fictional), loaded as a "data migration" so dashboards and trends
 * have context. Every record is labelled as migrated; e-signatures are flagged MIGRATED_RECORD.
 * Today's activity is created through the real application services in live.ts.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { AuditService } from '../../src/modules/audit/audit.service';
import { d, DAY, Ids } from './master';

const ACTOR = { name: 'Legacy data migration (demo seed)' };
const round = (n: number, p = 4) => Math.round(n * 10 ** p) / 10 ** p;

/** Deterministic pseudo-random so the demo data is identical on every reset. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

interface Ctx {
  prisma: PrismaClient;
  audit: AuditService;
  tenantId: string;
  site: string;
  users: Ids;
  m: { wh: Ids; bins: Ids; mat: Ids; prod: Ids; boms: Ids; routings: Ids; eq: Ids; specs: Ids; sup: Ids };
}

async function migrated(c: Ctx, entityType: string, entityId: string, label: string, next: unknown) {
  await c.prisma.$transaction((tx) => c.audit.record(tx, { tenantId: c.tenantId, actor: ACTOR, entityType, entityId, entityLabel: label, action: 'CREATE', next, reason: 'Migrated from legacy paper/ERP records (demo history)' }));
}

async function migratedSignature(c: Ctx, userKey: string, entityType: string, entityId: string, action: string, meaning: string, signedAt: Date) {
  const u = await c.prisma.user.findUniqueOrThrow({ where: { id: c.users[userKey] } });
  return c.prisma.electronicSignature.create({
    data: { tenantId: c.tenantId, userId: u.id, signerName: u.fullName, signerEmail: u.email, entityType, entityId, action, meaning: `${meaning} (migrated record — original signature on legacy batch record)`, recordHash: 'MIGRATED', authMethod: 'MIGRATED_RECORD', signedAt },
  });
}

let sampleSeq = 0;
async function approvedSample(
  c: Ctx,
  p: { stage: 'RAW_MATERIAL' | 'PACKAGING_MATERIAL' | 'FINISHED_PRODUCT'; specCode: string; materialId?: string; productId?: string; lotId?: string; batchId?: string; at: Date; values: Record<string, number | boolean>; conclusion?: 'PASS' | 'FAIL' },
) {
  const spec = await c.prisma.qcSpecification.findFirstOrThrow({ where: { tenantId: c.tenantId, code: p.specCode }, include: { tests: true } });
  sampleSeq++;
  const s = await c.prisma.qcSample.create({
    data: {
      tenantId: c.tenantId,
      siteId: c.site,
      number: `QCS-L-${String(sampleSeq).padStart(4, '0')}`,
      stage: p.stage,
      specificationId: spec.id,
      materialId: p.materialId,
      productId: p.productId,
      lotId: p.lotId,
      batchId: p.batchId,
      status: 'APPROVED',
      conclusion: p.conclusion ?? 'PASS',
      requestedAt: p.at,
      collectedAt: new Date(p.at.getTime() + 2 * 3_600_000),
      collectedById: c.users.qcAnalyst,
      submittedAt: new Date(p.at.getTime() + 30 * 3_600_000),
      reviewedAt: new Date(p.at.getTime() + 40 * 3_600_000),
      reviewedById: c.users.qcManager,
      approvedAt: new Date(p.at.getTime() + 48 * 3_600_000),
      approvedById: c.users.qcManager,
      createdAt: p.at,
    },
  });
  const results: { id: string; testName: string }[] = [];
  for (const t of spec.tests) {
    const v = p.values[t.name];
    const numeric = t.resultType === 'NUMERIC';
    const value = numeric ? (typeof v === 'number' ? v : Number(t.minValue ?? 0) + (Number(t.maxValue ?? Number(t.minValue ?? 0) + 2) - Number(t.minValue ?? 0)) / 2) : undefined;
    const pass = !numeric ? (typeof v === 'boolean' ? v : true) : undefined;
    let evaluation: 'WITHIN_SPEC' | 'OOS_CANDIDATE' = 'WITHIN_SPEC';
    if (numeric && value !== undefined) {
      if ((t.minValue !== null && value < Number(t.minValue)) || (t.maxValue !== null && value > Number(t.maxValue))) evaluation = 'OOS_CANDIDATE';
    }
    if (pass === false) evaluation = 'OOS_CANDIDATE';
    const r = await c.prisma.qcResult.create({
      data: {
        tenantId: c.tenantId,
        sampleId: s.id,
        specTestId: t.id,
        testName: t.name,
        resultType: t.resultType,
        specSnapshot: { operator: t.operator, minValue: t.minValue ? Number(t.minValue) : null, maxValue: t.maxValue ? Number(t.maxValue) : null, unit: t.unit } as Prisma.InputJsonValue,
        numericValue: value,
        passFail: pass,
        unit: t.unit,
        evaluation,
        instrument: t.name.includes('Assay') ? 'HPLC-01' : t.name.includes('Dissolution') ? 'DT-01' : null,
        analystId: c.users.qcAnalyst,
        enteredAt: new Date(p.at.getTime() + 26 * 3_600_000),
      },
    });
    results.push({ id: r.id, testName: t.name });
  }
  return { sample: s, results };
}

interface LotState {
  id: string;
  materialId: string;
  lotNumber: string;
  receivedAt: Date;
  qty: number;
  expiry: Date;
}

export async function seedHistory(c: Ctx) {
  const { prisma, tenantId, site, users, m } = c;
  const rand = rng(42);

  // ── Legacy batch schedule (6 months)
  const boms = await prisma.bom.findMany({ where: { tenantId }, include: { lines: true } });
  const routings = await prisma.routing.findMany({ where: { tenantId }, include: { steps: { orderBy: { sequence: 'asc' } } } });
  const products = await prisma.product.findMany({ where: { tenantId } });
  type Planned = { prefix: string; date: Date; monthsAgo: number; idx: number };
  const schedule: Planned[] = [];
  for (let monthsAgo = 6; monthsAgo >= 1; monthsAgo--) {
    const base = -monthsAgo * 30;
    schedule.push({ prefix: 'PCM', date: d(base + 4), monthsAgo, idx: 1 }, { prefix: 'PCM', date: d(base + 17), monthsAgo, idx: 2 });
    schedule.push({ prefix: 'AMX', date: d(base + 8), monthsAgo, idx: 1 }, { prefix: 'AMX', date: d(base + 21), monthsAgo, idx: 2 });
    schedule.push({ prefix: 'OMZ', date: d(base + 12), monthsAgo, idx: 1 });
  }
  schedule.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Pre-compute consumption per batch (actual within ±0.6 % of BOM).
  const consumption = schedule.map((s) => {
    const bom = boms.find((b) => b.productId === m.prod[s.prefix])!;
    return bom.lines.map((l) => ({ materialId: l.materialId, expected: Number(l.quantity), actual: round(Number(l.quantity) * (1 + (rand() - 0.5) * 0.012), 3) }));
  });
  const totals = new Map<string, number>();
  consumption.flat().forEach((x) => totals.set(x.materialId, (totals.get(x.materialId) ?? 0) + x.actual));

  // Remaining quantities at "today" (before live scenarios)
  const remainingTarget: Record<string, number> = {
    'API-PCM-001': 180,
    'API-AMX-001': 40,
    'API-OMZ-001': 60,
    'EXC-MCC-101': 90,
    'EXC-STA-001': 30,
    'EXC-PVP-K30': 14,
    'EXC-MGS-001': 9,
    'PKG-PVC-250': 500,
    'PKG-ALU-020': 160,
    'PKG-CAP-0': 260,
    'PKG-CAP-2': 180,
  };
  const supplierFor: Record<string, string> = {
    'API-PCM-001': 'SUP-001',
    'API-AMX-001': 'SUP-002',
    'API-OMZ-001': 'SUP-006',
    'EXC-MCC-101': 'SUP-003',
    'EXC-STA-001': 'SUP-003',
    'EXC-PVP-K30': 'SUP-003',
    'EXC-MGS-001': 'SUP-003',
    'PKG-PVC-250': 'SUP-004',
    'PKG-ALU-020': 'SUP-004',
    'PKG-CAP-0': 'SUP-005',
    'PKG-CAP-2': 'SUP-005',
  };
  const materials = await prisma.material.findMany({ where: { tenantId } });
  const uoms = await prisma.unitOfMeasure.findMany({ where: { tenantId } });
  const lots: LotState[] = [];
  const txns: Prisma.InventoryTransactionCreateManyInput[] = [];
  let lotSeq = 0;
  const createLot = async (code: string, qty: number, receivedDaysAgo: number, expiryInDays: number, opts: { status?: 'RELEASED' | 'REJECTED'; consume?: boolean; supplierBatch?: string } = {}) => {
    const mat = materials.find((x) => x.code === code)!;
    lotSeq++;
    const receivedAt = d(-receivedDaysAgo, 8);
    const lotNumber = `${mat.lotPrefix}L-${String(lotSeq).padStart(4, '0')}`;
    const wh = mat.type === 'PACKAGING' ? m.wh['WH-PM'] : m.wh['WH-RM'];
    const status = opts.status ?? 'RELEASED';
    const lot = await prisma.inventoryLot.create({
      data: {
        tenantId,
        siteId: site,
        itemType: 'MATERIAL',
        materialId: mat.id,
        lotNumber,
        supplierBatch: opts.supplierBatch ?? `SB-${code.slice(-3)}-${1000 + lotSeq}`,
        supplierId: m.sup[supplierFor[code]],
        mfgDate: d(-receivedDaysAgo - 60),
        expiryDate: d(expiryInDays, 0),
        quantity: qty,
        uomCode: uoms.find((u) => u.id === mat.uomId)!.code,
        warehouseId: status === 'REJECTED' ? m.wh['WH-REJ'] : wh,
        status,
        sourceType: 'MIGRATION',
        unitCost: mat.unitCost,
        dispositionById: users.qaManager,
        dispositionAt: new Date(receivedAt.getTime() + 5 * DAY),
        createdAt: receivedAt,
      },
    });
    txns.push({ tenantId, siteId: site, lotId: lot.id, type: 'GRN_RECEIPT', quantity: qty, balanceAfter: qty, statusTo: 'QUARANTINE', referenceType: 'Migration', performedById: users.warehouseOfficer, performedAt: receivedAt, reason: 'Opening balance — legacy receipt' });
    txns.push({ tenantId, siteId: site, lotId: lot.id, type: 'STATUS_CHANGE', quantity: 0, balanceAfter: qty, statusFrom: 'QUARANTINE', statusTo: status, referenceType: 'Migration', performedById: users.qaManager, performedAt: new Date(receivedAt.getTime() + 5 * DAY), reason: 'QA disposition (legacy)' });
    const specCode = `SPEC-${code}`;
    const fail = status === 'REJECTED';
    await approvedSample(c, {
      stage: mat.type === 'PACKAGING' ? 'PACKAGING_MATERIAL' : 'RAW_MATERIAL',
      specCode,
      materialId: mat.id,
      lotId: lot.id,
      at: new Date(receivedAt.getTime() + 3_600_000),
      values: fail ? { 'Visual inspection / print check': false } : {},
      conclusion: fail ? 'FAIL' : 'PASS',
    });
    if (opts.consume !== false) lots.push({ id: lot.id, materialId: mat.id, lotNumber, receivedAt, qty, expiry: d(expiryInDays, 0) });
    await migrated(c, 'InventoryLot', lot.id, lotNumber, { material: code, quantity: qty, status });
    return lot;
  };

  for (const [code, remaining] of Object.entries(remainingTarget)) {
    const mat = materials.find((x) => x.code === code)!;
    const total = round(totals.get(mat.id) ?? 0, 3);
    const first = round(total * 0.6, 3);
    await createLot(code, first, 200, code.startsWith('API-OMZ') ? 200 : 420);
    await createLot(code, round(total - first + remaining, 3), 95, code.startsWith('API-OMZ') ? 250 : 600);
  }

  // ── Legacy plans
  const planLines = new Map<string, string>();
  for (let monthsAgo = 6; monthsAgo >= 1; monthsAgo--) {
    const start = d(-monthsAgo * 30);
    const plan = await prisma.productionPlan.create({
      data: {
        tenantId,
        siteId: site,
        number: `PP-L-${7 - monthsAgo}`,
        name: `Monthly plan M-${monthsAgo}`,
        periodStart: start,
        periodEnd: d(-monthsAgo * 30 + 29),
        status: 'CLOSED',
        createdById: users.planner,
        approvedById: users.productionManager,
        approvedAt: start,
        lines: {
          create: [
            { tenantId, productId: m.prod.PCM, plannedQuantity: monthsAgo === 1 ? 600000 : 400000, plannedBatches: monthsAgo === 1 ? 3 : 2, demandQuantity: 450000 },
            { tenantId, productId: m.prod.AMX, plannedQuantity: 200000, plannedBatches: 2, demandQuantity: 200000 },
            { tenantId, productId: m.prod.OMZ, plannedQuantity: 100000, plannedBatches: 1, demandQuantity: 90000 },
          ],
        },
      },
      include: { lines: true },
    });
    for (const l of plan.lines) planLines.set(`${monthsAgo}:${l.productId}`, l.id);
  }

  // ── Legacy batches
  const fgWh = m.wh['WH-FG'];
  const batchIds: Record<string, string> = {};
  const n = { PCM: 0, AMX: 0, OMZ: 0 } as Record<string, number>;
  for (const [i, s] of schedule.entries()) {
    const product = products.find((p) => p.id === m.prod[s.prefix])!;
    const bom = boms.find((b) => b.productId === product.id)!;
    const routing = routings.find((r) => r.productId === product.id)!;
    n[s.prefix]++;
    const year = s.date.getUTCFullYear();
    const batchNumber = `${s.prefix}-${year}-L${String(n[s.prefix]).padStart(4, '0')}`;
    const isRejected = s.prefix === 'AMX' && s.monthsAgo === 3 && s.idx === 2;
    const lowYield = s.prefix === 'PCM' && s.monthsAgo === 2 && s.idx === 1;
    const plannedQty = Number(product.standardBatchSize);
    const yieldPct = lowYield ? 96.8 : round(97.6 + rand() * 2.6, 2);
    const actual = Math.round((plannedQty * yieldPct) / 100);
    const start = s.date;
    const end = new Date(start.getTime() + (2 + rand()) * DAY);
    const qaAt = new Date(end.getTime() + (isRejected ? 12 : 2 + rand() * 4) * DAY);
    const status = isRejected ? 'REJECTED' : s.monthsAgo === 1 ? 'RELEASED' : 'CLOSED';
    const expiry = new Date(start);
    expiry.setMonth(expiry.getMonth() + product.shelfLifeMonths);
    const batch = await prisma.batch.create({
      data: {
        tenantId,
        siteId: site,
        batchNumber,
        productId: product.id,
        planLineId: planLines.get(`${s.monthsAgo}:${product.id}`),
        bomId: bom.id,
        routingId: routing.id,
        plannedQuantity: plannedQty,
        theoreticalYield: plannedQty,
        actualYield: actual,
        yieldPct,
        yieldWithinLimits: yieldPct >= 98 && yieldPct <= 102,
        yieldJustification: yieldPct < 98 ? 'Excess compression rejects due to punch wear on TP-02; see deviation DEV-L-011.' : null,
        uomCode: s.prefix === 'PCM' ? 'TAB' : 'CAP',
        status,
        plannedStart: start,
        plannedEnd: new Date(start.getTime() + 3 * DAY),
        actualStart: start,
        actualEnd: end,
        mfgDate: start,
        expiryDate: expiry,
        createdById: users.planner,
        qaDecisionById: users.qaManager,
        qaDecisionAt: qaAt,
        qaDecisionComment: isRejected ? 'Rejected: confirmed OOS dissolution (OOS-L-001).' : 'Released after review of batch record (legacy).',
        createdAt: new Date(start.getTime() - 5 * DAY),
      },
    });
    batchIds[`${s.prefix}:${s.monthsAgo}:${s.idx}`] = batch.id;
    let t = start.getTime();
    for (const st of routing.steps) {
      const params = (st.parameters as { code: string; min?: number; max?: number }[]) ?? [];
      const ipcs = (st.ipcChecks as { code: string; min?: number; max?: number }[]) ?? [];
      const val = (p: { min?: number; max?: number }) => round((p.min ?? 0) + ((p.max ?? (p.min ?? 0) + 2) - (p.min ?? 0)) * (0.35 + rand() * 0.3), 2);
      const started = new Date(t);
      t += (st.expectedDurationMin ?? 60) * 60_000 * 1.1;
      await prisma.batchStep.create({
        data: {
          tenantId,
          batchId: batch.id,
          routingStepId: st.id,
          sequence: st.sequence,
          code: st.code,
          name: st.name,
          instructions: st.instructions,
          equipmentType: st.equipmentType,
          expectedDurationMin: st.expectedDurationMin,
          requiresVerification: st.requiresVerification,
          consumesMaterials: st.consumesMaterials,
          recordsOutput: st.recordsOutput,
          parameterDefs: st.parameters as Prisma.InputJsonValue,
          ipcDefs: st.ipcChecks as Prisma.InputJsonValue,
          status: 'VERIFIED',
          equipmentId: st.equipmentType ? (Object.entries(m.eq).find(([k]) => (st.equipmentType === 'TABLET_PRESS' ? k === (s.monthsAgo === 2 ? 'TP-02' : 'TP-01') : false))?.[1] ?? null) : null,
          readings: Object.fromEntries(params.map((p) => [p.code, val(p)])) as Prisma.InputJsonValue,
          ipcResults: Object.fromEntries(ipcs.map((p) => [p.code, val(p)])) as Prisma.InputJsonValue,
          outputQuantity: st.recordsOutput ? actual : null,
          startedAt: started,
          startedById: s.prefix === 'PCM' ? users.operator : users.operator2,
          completedAt: new Date(t),
          completedById: s.prefix === 'PCM' ? users.operator : users.operator2,
          verifiedAt: new Date(t + 30 * 60_000),
          verifiedById: users.supervisor,
          remarks: 'Migrated from paper BMR',
        },
      });
    }
    // consumption FEFO from legacy lots
    for (const cons of consumption[i]) {
      let need = cons.actual;
      const avail = lots.filter((l) => l.materialId === cons.materialId && l.receivedAt < start && l.qty > 0).sort((a, b) => a.expiry.getTime() - b.expiry.getTime() || a.receivedAt.getTime() - b.receivedAt.getTime());
      for (const l of avail) {
        if (need <= 0) break;
        const take = round(Math.min(l.qty, need), 3);
        l.qty = round(l.qty - take, 3);
        need = round(need - take, 3);
        txns.push({ tenantId, siteId: site, lotId: l.id, type: 'ISSUE_TO_PRODUCTION', quantity: -take, balanceAfter: l.qty, referenceType: 'Batch', referenceId: batch.id, performedById: users.warehouseOfficer, performedAt: new Date(start.getTime() - 3_600_000), reason: `Issued to ${batchNumber}` });
        await prisma.batchMaterialConsumption.create({
          data: { tenantId, batchId: batch.id, materialId: cons.materialId, lotId: l.id, expectedQuantity: round((cons.expected * take) / cons.actual, 3), actualQuantity: take, variancePct: round(((cons.actual - cons.expected) / cons.expected) * 100, 2), uomCode: '—', recordedById: users.operator, recordedAt: start },
        });
      }
      if (need > 0.01) throw new Error(`Seed history: insufficient legacy stock for ${cons.materialId} on ${batchNumber}`);
    }
    // FG lot + sample
    const remainingFg = isRejected ? actual : s.monthsAgo === 1 ? Math.round(actual * 0.45) : s.monthsAgo === 2 && s.prefix === 'PCM' && s.idx === 2 ? 8000 : 0;
    const fg = await prisma.inventoryLot.create({
      data: {
        tenantId,
        siteId: site,
        itemType: 'PRODUCT',
        productId: product.id,
        lotNumber: batchNumber,
        batchId: batch.id,
        mfgDate: start,
        expiryDate: s.monthsAgo === 2 && s.prefix === 'PCM' && s.idx === 2 ? d(80, 0) : expiry,
        quantity: remainingFg,
        uomCode: s.prefix === 'PCM' ? 'TAB' : 'CAP',
        warehouseId: isRejected ? m.wh['WH-REJ'] : fgWh,
        status: isRejected ? 'REJECTED' : 'RELEASED',
        sourceType: 'BATCH',
        sourceId: batch.id,
        unitCost: product.unitPrice,
        dispositionById: users.qaManager,
        dispositionAt: qaAt,
        createdAt: end,
      },
    });
    txns.push({ tenantId, siteId: site, lotId: fg.id, type: 'FG_RECEIPT', quantity: actual, balanceAfter: actual, statusTo: 'QUARANTINE', referenceType: 'Batch', referenceId: batch.id, performedById: users.productionManager, performedAt: end });
    txns.push({ tenantId, siteId: site, lotId: fg.id, type: 'STATUS_CHANGE', quantity: 0, balanceAfter: actual, statusFrom: 'QUARANTINE', statusTo: isRejected ? 'REJECTED' : 'RELEASED', referenceType: 'Batch', referenceId: batch.id, performedById: users.qaManager, performedAt: qaAt });
    if (!isRejected && remainingFg < actual) {
      txns.push({ tenantId, siteId: site, lotId: fg.id, type: 'DISPATCH', quantity: -(actual - remainingFg), balanceAfter: remainingFg, referenceType: 'Dispatch', performedById: users.warehouseManager, performedAt: new Date(qaAt.getTime() + 4 * DAY), reason: 'Dispatched to distributors (legacy ERP)' });
    }
    const fpValues: Record<string, number | boolean> = s.prefix === 'PCM' ? { Assay: round(98 + rand() * 3, 1), 'Dissolution (30 min)': round(86 + rand() * 8, 1), 'Disintegration time': round(4 + rand() * 5, 1) } : s.prefix === 'AMX' ? { Assay: round(97 + rand() * 5, 1), 'Dissolution (60 min)': isRejected ? 71 : round(85 + rand() * 9, 1) } : { Assay: round(97 + rand() * 6, 1), 'Acid resistance stage': round(2 + rand() * 4, 1) };
    const { sample, results } = await approvedSample(c, { stage: 'FINISHED_PRODUCT', specCode: `SPEC-FP-${product.code}`, productId: product.id, batchId: batch.id, lotId: fg.id, at: end, values: fpValues, conclusion: isRejected ? 'FAIL' : 'PASS' });
    await migratedSignature(c, 'qaManager', 'Batch', batch.id, isRejected ? 'BATCH_QA_REJECT' : 'BATCH_QA_RELEASE', isRejected ? 'QA rejection' : 'QA release', qaAt);
    await migrated(c, 'Batch', batch.id, batchNumber, { product: product.code, status, yieldPct });
    if (isRejected) {
      const r = results.find((x) => x.testName.startsWith('Dissolution'))!;
      batchIds.rejectedOosResult = r.id;
      batchIds.rejectedSample = sample.id;
    }
  }

  // ── Special inventory situations (near-expiry, expired, rejected supplier lots)
  await createLot('EXC-STA-001', 25, 330, 20, { consume: false });
  await createLot('EXC-MGS-001', 4, 300, 50, { consume: false });
  await createLot('EXC-PVP-K30', 6, 280, 75, { consume: false });
  await createLot('EXC-MCC-101', 12, 700, -5, { consume: false });
  await createLot('PKG-ALU-020', 30, 140, 700, { status: 'REJECTED', consume: false, supplierBatch: 'IPI-FOIL-2231' });
  await createLot('PKG-PVC-250', 80, 120, 700, { status: 'REJECTED', consume: false, supplierBatch: 'IPI-PVC-1180' });

  // Apply final lot quantities and write ledger history in time order.
  for (const l of lots) await prisma.inventoryLot.update({ where: { id: l.id }, data: { quantity: l.qty } });
  txns.sort((a, b) => (a.performedAt as Date).getTime() - (b.performedAt as Date).getTime());
  await prisma.inventoryTransaction.createMany({ data: txns });


  return { batchIds };
}

/** Legacy quality events: deviations, RCA, CAPA, OOS spread over six months. */
export async function seedQualityHistory(c: Ctx, batchIds: Record<string, string>) {
  const { prisma, tenantId, site, users, m } = c;
  const depts = await prisma.department.findMany({ where: { tenantId } });
  const dept = (name: string) => depts.find((x) => x.name === name)?.id;
  type Dev = {
    days: number;
    cat: string;
    title: string;
    sev: 'MINOR' | 'MAJOR' | 'CRITICAL';
    status: 'CLOSED' | 'INVESTIGATION' | 'EFFECTIVENESS_CHECK' | 'SUBMITTED';
    rca?: [string, string];
    equipment?: string;
    product?: string;
    batch?: string;
    capa?: 'CLOSED' | 'OVERDUE' | 'CLOSED_WITH_FAILURE';
  };
  const devs: Dev[] = [
    { days: 170, cat: 'COMPRESSION', title: 'Tablet weight variation outside IPC limits on TP-02', sev: 'MAJOR', status: 'CLOSED', rca: ['MACHINE', 'Worn upper punches on TP-02 causing fill depth variation'], equipment: 'TP-02', product: 'PCM', capa: 'CLOSED_WITH_FAILURE' },
    { days: 150, cat: 'DISPENSING', title: 'Incorrect status label on MCC container at dispensing', sev: 'MINOR', status: 'CLOSED', rca: ['HUMAN', 'Label not replaced after QA release; SOP step ambiguous'] },
    { days: 140, cat: 'COMPRESSION', title: 'Capping observed during compression of Paracetamol batch', sev: 'MAJOR', status: 'CLOSED', rca: ['METHOD', 'Granule moisture below range after extended drying'], product: 'PCM', capa: 'CLOSED' },
    { days: 120, cat: 'WAREHOUSE', title: 'Temperature excursion in RM store (27.5 °C for 3 h)', sev: 'MINOR', status: 'CLOSED', rca: ['ENVIRONMENT', 'HVAC compressor trip during load-shedding'] },
    { days: 110, cat: 'GRANULATION', title: 'Granulation end-point exceeded by 2 minutes', sev: 'MINOR', status: 'CLOSED', rca: ['HUMAN', 'Timer not reset between sub-lots'], equipment: 'RMG-01' },
    { days: 95, cat: 'COMPRESSION', title: 'Tablet hardness below limit at press start-up', sev: 'MINOR', status: 'CLOSED', rca: ['METHOD', 'Start-up settings not verified against batch record'], equipment: 'TP-01' },
    { days: 90, cat: 'LABORATORY', title: 'Amoxicillin capsules dissolution OOS — confirmed', sev: 'MAJOR', status: 'CLOSED', rca: ['MATERIAL', 'Over-lubrication: magnesium stearate blending time exceeded'], product: 'AMX', batch: 'AMX:3:2', capa: 'CLOSED' },
    { days: 85, cat: 'LABORATORY', title: 'HPLC system suitability failure (tailing factor)', sev: 'MINOR', status: 'CLOSED', rca: ['MEASUREMENT', 'Column degradation beyond recommended injections'] },
    { days: 75, cat: 'PACKING', title: 'Blister seal integrity failure in leak test', sev: 'MAJOR', status: 'CLOSED', rca: ['MACHINE', 'Sealing roller temperature controller drift'], equipment: 'BLS-01', capa: 'CLOSED' },
    { days: 60, cat: 'COMPRESSION', title: 'Punch tip breakage on TP-02 during Paracetamol compression', sev: 'MAJOR', status: 'EFFECTIVENESS_CHECK', rca: ['MACHINE', 'No preventive punch inspection programme; punches beyond service life'], equipment: 'TP-02', product: 'PCM', capa: 'OVERDUE' },
    { days: 50, cat: 'ENCAPSULATION', title: 'Capsule fill weight drift on ENC-01', sev: 'MINOR', status: 'CLOSED', rca: ['MACHINE', 'Dosing disc wear'], equipment: 'ENC-01', product: 'AMX' },
    { days: 45, cat: 'COMPRESSION', title: 'Low yield (96.8 %) due to excessive compression rejects', sev: 'MAJOR', status: 'CLOSED', rca: ['MACHINE', 'Punch wear on TP-02 (repeat of earlier finding)'], equipment: 'TP-02', product: 'PCM', batch: 'PCM:2:1', capa: 'CLOSED' },
    { days: 40, cat: 'DISPENSING', title: 'Weighing of Povidone K30 outside dispensing tolerance', sev: 'MAJOR', status: 'INVESTIGATION', equipment: 'BAL-02', product: 'PCM' },
    { days: 6, cat: 'PACKING', title: 'Printed foil batch code misalignment on blister line', sev: 'MINOR', status: 'SUBMITTED', equipment: 'BLS-01', product: 'PCM' },
  ];
  const ids: string[] = [];
  let capaN = 0;
  for (const [i, v] of devs.entries()) {
    const occurred = d(-v.days, 10);
    const closed = v.status === 'CLOSED';
    const dev = await prisma.deviation.create({
      data: {
        tenantId,
        siteId: site,
        departmentId: dept(v.cat === 'LABORATORY' ? 'Quality Control' : v.cat === 'WAREHOUSE' ? 'Warehouse' : 'Production'),
        number: `DEV-L-${String(i + 1).padStart(3, '0')}`,
        title: v.title,
        description: `${v.title}. Observed during routine operations and reported immediately to the area supervisor.`,
        immediateAction: 'Operation stopped, affected material segregated and QA informed.',
        category: v.cat,
        proposedSeverity: v.sev,
        classification: v.status === 'SUBMITTED' ? null : v.sev,
        productId: v.product ? m.prod[v.product] : null,
        batchId: v.batch ? batchIds[v.batch] : null,
        equipmentId: v.equipment ? m.eq[v.equipment] : null,
        status: v.status,
        occurredAt: occurred,
        reportedById: v.cat === 'LABORATORY' ? users.qcAnalyst : users.supervisor,
        ownerId: v.status === 'SUBMITTED' ? null : users.qaOfficer,
        dueDate: v.status === 'SUBMITTED' ? null : new Date(occurred.getTime() + 30 * DAY),
        submittedAt: occurred,
        qaReviewNotes: v.status === 'SUBMITTED' ? null : 'Classified after QA review of impact on product quality.',
        investigationSummary: v.rca ? 'Investigation completed: interviews, equipment logs and batch record review.' : null,
        impactAssessment: v.rca ? 'No impact on released product; affected units rejected.' : null,
        capaRequired: v.capa ? true : v.rca && closed ? false : null,
        noCapaJustification: !v.capa && closed ? 'Isolated event; corrected through retraining under existing SOP.' : null,
        effectivenessSummary: closed ? 'No recurrence observed during the review period.' : null,
        closedAt: closed ? new Date(occurred.getTime() + 25 * DAY) : null,
        closedById: closed ? users.qaManager : null,
        createdAt: occurred,
      },
    });
    ids.push(dev.id);
    if (v.rca) {
      await prisma.rootCauseAnalysis.create({
        data: {
          tenantId,
          deviationId: dev.id,
          fiveWhys: [
            { question: 'Why did the event occur?', answer: v.title },
            { question: 'Why was that condition present?', answer: v.rca[1] },
            { question: 'Why was it not detected earlier?', answer: 'Existing checks did not cover this failure mode.' },
          ] as Prisma.InputJsonValue,
          fishbone: { [v.rca[0]]: [v.rca[1]] } as Prisma.InputJsonValue,
          primaryCategory: v.rca[0],
          statement: v.rca[1],
          createdById: users.qaOfficer,
          approvedById: users.qaManager,
          approvedAt: new Date(occurred.getTime() + 12 * DAY),
          createdAt: new Date(occurred.getTime() + 10 * DAY),
        },
      });
    }
    if (closed) await migratedSignature(c, 'qaManager', 'Deviation', dev.id, 'DEVIATION_CLOSURE', 'QA approval: deviation closed', new Date(occurred.getTime() + 25 * DAY));
    if (v.capa) {
      capaN++;
      const overdue = v.capa === 'OVERDUE';
      const capa = await prisma.capa.create({
        data: {
          tenantId,
          siteId: site,
          number: `CAPA-L-${String(capaN).padStart(3, '0')}`,
          source: 'DEVIATION',
          deviationId: dev.id,
          problemStatement: v.title,
          rootCause: v.rca?.[1],
          priority: v.sev === 'MAJOR' ? 'HIGH' : 'MEDIUM',
          ownerId: overdue ? users.engineering : users.qaOfficer,
          departmentId: dept(overdue ? 'Engineering' : 'Quality Assurance'),
          dueDate: overdue ? d(-10) : new Date(occurred.getTime() + 60 * DAY),
          status: overdue ? 'IN_PROGRESS' : 'CLOSED',
          effectivenessCriteria: 'No recurrence of the failure mode in the next 10 batches.',
          effectivenessResult: overdue ? null : 'No recurrence in subsequent batches.',
          effectivenessEffective: overdue ? null : true,
          effectivenessCheckedAt: overdue ? null : new Date(occurred.getTime() + 55 * DAY),
          effectivenessCheckedById: overdue ? null : users.qaManager,
          effectivenessFailures: v.capa === 'CLOSED_WITH_FAILURE' ? 1 : 0,
          closedAt: overdue ? null : new Date(occurred.getTime() + 58 * DAY),
          closedById: overdue ? null : users.qaManager,
          createdById: users.qaOfficer,
          createdAt: new Date(occurred.getTime() + 14 * DAY),
          actions: {
            create: overdue
              ? [
                  { tenantId, type: 'CORRECTIVE', description: 'Replace all upper and lower punches on TP-02 and record tooling inspection', ownerId: users.engineering, dueDate: d(-25), status: 'COMPLETED', evidence: 'Tooling change record TC-114; new punch set serials logged.', completedAt: d(-28), completedById: users.engineering },
                  { tenantId, type: 'PREVENTIVE', description: 'Introduce preventive punch inspection programme (every 250,000 tablets) in maintenance SOP', ownerId: users.engineering, dueDate: d(-10), status: 'OPEN' },
                ]
              : [
                  { tenantId, type: 'CORRECTIVE', description: `Correct the immediate cause: ${v.rca?.[1]}`, ownerId: users.qaOfficer, dueDate: new Date(occurred.getTime() + 30 * DAY), status: 'COMPLETED', evidence: 'Completion record attached in legacy QMS.', completedAt: new Date(occurred.getTime() + 28 * DAY), completedById: users.qaOfficer },
                  { tenantId, type: 'PREVENTIVE', description: 'Update SOP and retrain affected staff', ownerId: users.qaOfficer, dueDate: new Date(occurred.getTime() + 45 * DAY), status: 'COMPLETED', evidence: 'SOP revision and training records.', completedAt: new Date(occurred.getTime() + 40 * DAY), completedById: users.qaOfficer },
                ],
          },
        },
      });
      if (!overdue) await migratedSignature(c, 'qaManager', 'Capa', capa.id, 'CAPA_CLOSURE', 'QA approval: CAPA closed', new Date(occurred.getTime() + 58 * DAY));
    }
    await migrated(c, 'Deviation', dev.id, dev.number, { title: v.title, status: v.status });
  }

  // Supplier CAPA (open, not yet due): expired ISO 15378 certificate at packaging supplier
  await prisma.capa.create({
    data: {
      tenantId,
      siteId: site,
      number: 'CAPA-L-099',
      source: 'SUPPLIER',
      problemStatement: 'Indus Packaging ISO 15378 certificate expired; two packaging lots rejected for print/dimension defects in last quarter.',
      rootCause: 'Supplier quality system lapse; certificate renewal not tracked.',
      priority: 'MEDIUM',
      ownerId: users.procurementManager,
      departmentId: dept('Procurement'),
      dueDate: d(20),
      status: 'OPEN',
      effectivenessCriteria: 'Renewed certificate on file and zero packaging rejections in next 5 lots.',
      createdById: users.qaManager,
      createdAt: d(-15),
      actions: {
        create: [
          { tenantId, type: 'CORRECTIVE', description: 'Obtain renewed ISO 15378 certificate from supplier', ownerId: users.procurementManager, dueDate: d(10) },
          { tenantId, type: 'PREVENTIVE', description: 'Perform supplier audit of Indus Packaging print control', ownerId: users.qaOfficer, dueDate: d(20) },
        ],
      },
    },
  });

  // Legacy OOS: confirmed (rejected AMX batch) and invalidated (lab error)
  const amxBatch = batchIds['AMX:3:2'];
  const amxDev = ids[6];
  await prisma.oosInvestigation.create({
    data: {
      tenantId,
      siteId: site,
      number: 'OOS-L-001',
      qcResultId: batchIds.rejectedOosResult,
      sampleId: batchIds.rejectedSample,
      productId: m.prod.AMX,
      batchId: amxBatch,
      testName: 'Dissolution (60 min)',
      specification: '≥ 80 %',
      actualResult: '71 %',
      analystId: users.qcAnalyst,
      instrument: 'DT-01',
      method: 'TM-DISS',
      status: 'CLOSED',
      ownerId: users.qaOfficer,
      dueDate: d(-60),
      preliminaryFindings: 'Calculations and instrument checked; no obvious error.',
      labInvestigation: 'Standard, media and apparatus verified. Re-measurement of original solutions confirmed result.',
      assignableLabError: false,
      manufacturingInvestigation: 'Blending time on BLD-01 exceeded (22 min vs 15 min).',
      rootCause: 'Over-lubrication with magnesium stearate reduced dissolution.',
      impactAssessment: 'Batch rejected; no other batches affected (blend times verified).',
      conclusion: 'CONFIRMED_OOS',
      deviationId: amxDev,
      closedAt: d(-75),
      closedById: users.qaManager,
      createdAt: d(-90),
    },
  });
  await prisma.deviation.update({ where: { id: amxDev }, data: { batchId: amxBatch } });
}
