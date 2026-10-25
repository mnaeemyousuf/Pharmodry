import { Injectable } from '@nestjs/common';
import { Batch, BatchStatus, Prisma } from '@prisma/client';
import { BATCH_TRANSITIONS, calculateYield, OPEN_DEVIATION_STATUSES, OPEN_OOS_STATUSES, type BlockingReason } from '@pharmodry/types';
import { AuthPrincipal } from '../../common/auth-user';
import { assertTransition, ConflictError, NotFoundError, RuleViolationError, ValidationError } from '../../common/errors';
import { FilterQueryDto, orderBy, pageArgs, statusFilter, toPage } from '../../common/pagination';
import { PrismaService, Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NumberingService, SettingsService, UserDirectory } from '../core/core.services';
import { InventoryLedger } from '../inventory/ledger.service';
import { NotificationService } from '../notifications/notification.service';
import { SampleRequestService } from '../sampling/sample-request.service';
import { SignatureService } from '../signatures/signature.service';
import { CompleteBatchDto, CreateBatchDto, QaDecisionDto } from './production.dto';

const DAY = 86_400_000;
const ACTIVE: BatchStatus[] = ['PLANNED', 'MATERIAL_RESERVED', 'READY', 'IN_PROGRESS', 'AWAITING_QC', 'AWAITING_QA'];

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly settings: SettingsService,
    private readonly ledger: InventoryLedger,
    private readonly sampling: SampleRequestService,
    private readonly notifications: NotificationService,
    private readonly signatures: SignatureService,
    private readonly users: UserDirectory,
  ) {}

  private viewFilter(view?: string): Prisma.BatchWhereInput {
    const now = new Date();
    switch (view) {
      case 'active':
        return { status: { in: ACTIVE } };
      case 'awaitingQa':
        return { status: 'AWAITING_QA' };
      case 'delayed':
        return {
          OR: [
            { status: { in: ['PLANNED', 'MATERIAL_RESERVED', 'READY'] }, plannedStart: { lt: now } },
            { status: { in: ['IN_PROGRESS', 'AWAITING_QC', 'AWAITING_QA'] }, plannedEnd: { lt: now } },
          ],
        };
      default:
        return {};
    }
  }

  async list(q: FilterQueryDto) {
    const where: Prisma.BatchWhereInput = {
      AND: [
        this.viewFilter(q.view),
        {
          status: statusFilter(q),
          productId: q.productId || undefined,
          siteId: q.siteId || undefined,
          createdAt: q.from || q.to ? { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } : undefined,
          ...(q.q ? { batchNumber: { contains: q.q, mode: 'insensitive' } } : {}),
        },
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.batch.findMany({
        where,
        include: { product: { select: { code: true, genericName: true, strength: true, brandName: true } } },
        orderBy: orderBy(q, ['batchNumber', 'plannedStart', 'status', 'createdAt', 'yieldPct'], { createdAt: 'desc' }),
        ...pageArgs(q),
      }),
      this.prisma.db.batch.count({ where }),
    ]);
    const now = Date.now();
    return toPage(
      rows.map((b) => ({
        ...b,
        delayed:
          (['PLANNED', 'MATERIAL_RESERVED', 'READY'].includes(b.status) && b.plannedStart.getTime() < now) ||
          (['IN_PROGRESS', 'AWAITING_QC', 'AWAITING_QA'].includes(b.status) && !!b.plannedEnd && b.plannedEnd.getTime() < now),
      })),
      total,
      q,
    );
  }

  async get(id: string) {
    const batch = await this.prisma.db.batch.findFirst({
      where: { id },
      include: {
        product: { include: { dosageForm: true } },
        steps: { orderBy: { sequence: 'asc' }, include: { corrections: { orderBy: { correctedAt: 'asc' } } } },
        consumptions: { orderBy: { recordedAt: 'asc' } },
      },
    });
    if (!batch) throw new NotFoundError('Batch', id);
    const [reservations, samples, oos, deviations, fgLots, signatures, bom, site] = await Promise.all([
      this.prisma.db.materialReservation.findMany({ where: { batchId: id } }),
      this.prisma.db.qcSample.findMany({ where: { batchId: id }, orderBy: { createdAt: 'asc' } }),
      this.prisma.db.oosInvestigation.findMany({ where: { batchId: id }, select: { id: true, number: true, status: true, conclusion: true, testName: true, actualResult: true, specification: true } }),
      this.prisma.db.deviation.findMany({ where: { batchId: id }, select: { id: true, number: true, title: true, status: true, classification: true } }),
      this.prisma.db.inventoryLot.findMany({ where: { batchId: id, itemType: 'PRODUCT' } }),
      this.signatures.forEntity('Batch', id),
      this.prisma.db.bom.findFirst({ where: { id: batch.bomId }, include: { lines: true } }),
      this.prisma.db.site.findFirst({ where: { id: batch.siteId }, select: { code: true, name: true } }),
    ]);
    const capas = await this.prisma.db.capa.findMany({
      where: { OR: [{ deviationId: { in: deviations.map((d) => d.id) } }, { oosId: { in: oos.map((o) => o.id) } }] },
      select: { id: true, number: true, status: true, problemStatement: true },
    });
    const stepStepIds = batch.steps.map((s) => s.id);
    const lotIds = [...new Set([...reservations.map((r) => r.lotId), ...batch.consumptions.map((c) => c.lotId)])];
    const [lots, materials, equipment] = await Promise.all([
      this.prisma.db.inventoryLot.findMany({ where: { id: { in: lotIds } }, select: { id: true, lotNumber: true, status: true, expiryDate: true } }),
      this.prisma.db.material.findMany({ where: { id: { in: bom?.lines.map((l) => l.materialId) ?? [] } }, select: { id: true, code: true, name: true, type: true } }),
      this.prisma.db.equipment.findMany({ where: { id: { in: batch.steps.map((s) => s.equipmentId).filter(Boolean) as string[] } }, select: { id: true, code: true, description: true } }),
    ]);
    const factor = bom ? Number(batch.plannedQuantity) / Number(bom.batchSize) : 1;
    const requirements = (bom?.lines ?? []).map((l) => {
      const m = materials.find((x) => x.id === l.materialId);
      const res = reservations.filter((r) => r.materialId === l.materialId && r.status !== 'RELEASED');
      const consumed = batch.consumptions.filter((c) => c.materialId === l.materialId).reduce((a, c) => a + Number(c.actualQuantity), 0);
      return {
        materialId: l.materialId,
        code: m?.code,
        name: m?.name,
        type: m?.type,
        required: Math.round(Number(l.quantity) * factor * 10_000) / 10_000,
        reserved: res.reduce((a, r) => a + Number(r.quantity), 0),
        consumed,
        tolerancePct: Number(l.tolerancePct),
        lots: res.map((r) => ({ ...r, lot: lots.find((x) => x.id === r.lotId) })),
      };
    });
    const steps = await this.users.decorate(
      batch.steps.map((s) => ({ ...s, equipment: equipment.find((e) => e.id === s.equipmentId) ?? null })),
      ['startedById', 'completedById', 'verifiedById'],
    );
    const settings = await this.settings.get(batch.tenantId);
    return this.users.decorateOne(
      {
        ...batch,
        site,
        steps: await Promise.all(steps.map(async (s) => ({ ...s, corrections: await this.users.decorate(s.corrections, ['correctedById']) }))),
        consumptions: (await this.users.decorate(batch.consumptions, ['recordedById'])).map((c) => ({ ...c, lot: lots.find((l) => l.id === c.lotId) })),
        requirements,
        samples,
        oos,
        deviations,
        capas,
        finishedGoods: fgLots,
        signatures,
        yieldTolerance: settings.yieldTolerance,
        stepCount: stepStepIds.length,
      },
      ['createdById', 'qaDecisionById'],
    );
  }

  async load(tx: Tx, id: string) {
    const b = await tx.batch.findFirst({ where: { id } });
    if (!b) throw new NotFoundError('Batch', id);
    return b;
  }

  async transition(tx: Tx, b: Batch, to: BatchStatus, data: Prisma.BatchUpdateManyMutationInput = {}, reason?: string) {
    assertTransition(BATCH_TRANSITIONS, 'Batch', b.status, to);
    const res = await tx.batch.updateMany({ where: { id: b.id, version: b.version }, data: { ...data, status: to, version: { increment: 1 } } });
    if (res.count !== 1) throw new ConflictError(`Batch ${b.batchNumber} was modified concurrently; reload and retry`, undefined, 'CONCURRENT_MODIFICATION');
    await this.audit.record(tx, { entityType: 'Batch', entityId: b.id, entityLabel: b.batchNumber, action: 'STATUS_CHANGE', previous: { status: b.status }, next: { status: to, ...data }, reason });
  }

  async create(user: AuthPrincipal, dto: CreateBatchDto) {
    user.require('batch.create', dto.siteId);
    return this.prisma.transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: dto.productId } });
      if (!product) throw new NotFoundError('Product', dto.productId);
      if (product.status !== 'ACTIVE') throw new RuleViolationError(`Product ${product.code} is not active`);
      const [bom, routing] = await Promise.all([
        tx.bom.findFirst({ where: { productId: product.id, status: 'ACTIVE' }, orderBy: { version: 'desc' } }),
        tx.routing.findFirst({ where: { productId: product.id, status: 'ACTIVE' }, orderBy: { version: 'desc' }, include: { steps: { orderBy: { sequence: 'asc' } } } }),
      ]);
      if (!bom) throw new RuleViolationError(`Product ${product.code} has no active BOM`);
      if (!routing || routing.steps.length === 0) throw new RuleViolationError(`Product ${product.code} has no active manufacturing template (routing)`);
      if (dto.planLineId) {
        const line = await tx.productionPlanLine.findFirst({ where: { id: dto.planLineId }, include: { plan: true } });
        if (!line || line.productId !== product.id) throw new ValidationError('Plan line does not belong to this product');
        if (line.plan.status !== 'APPROVED') throw new RuleViolationError(`Production plan ${line.plan.number} is not approved`);
      }
      const uom = await tx.unitOfMeasure.findFirst({ where: { id: product.uomId } });
      const qty = dto.plannedQuantity ?? Number(product.standardBatchSize);
      const batchNumber = await this.numbering.next(tx, user.tenantId, 'BATCH', { prefix: product.batchPrefix });
      const plannedStart = new Date(dto.plannedStart);
      const durationMin = routing.steps.reduce((a, s) => a + (s.expectedDurationMin ?? 60), 0);
      const batch = await tx.batch.create({
        data: {
          tenantId: user.tenantId,
          siteId: dto.siteId,
          batchNumber,
          productId: product.id,
          planLineId: dto.planLineId,
          bomId: bom.id,
          routingId: routing.id,
          productionLineId: dto.productionLineId,
          plannedQuantity: qty,
          theoreticalYield: qty,
          uomCode: uom?.code ?? 'EA',
          plannedStart,
          plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : new Date(plannedStart.getTime() + Math.max(durationMin * 60_000 * 2, 2 * DAY)),
          createdById: user.id,
          steps: {
            create: routing.steps.map((s) => ({
              tenantId: user.tenantId,
              routingStepId: s.id,
              sequence: s.sequence,
              code: s.code,
              name: s.name,
              instructions: s.instructions,
              equipmentType: s.equipmentType,
              expectedDurationMin: s.expectedDurationMin,
              requiresVerification: s.requiresVerification,
              consumesMaterials: s.consumesMaterials,
              recordsOutput: s.recordsOutput,
              parameterDefs: s.parameters as Prisma.InputJsonValue,
              ipcDefs: s.ipcChecks as Prisma.InputJsonValue,
            })),
          },
        },
      });
      await this.audit.record(tx, {
        entityType: 'Batch',
        entityId: batch.id,
        entityLabel: batchNumber,
        action: 'CREATE',
        next: { product: product.code, plannedQuantity: qty, bomVersion: bom.version, routingVersion: routing.version, status: 'PLANNED' },
      });
      return batch;
    });
  }

  /** FEFO reservation of every BOM line. All-or-nothing: any shortage aborts with details. */
  async reserve(user: AuthPrincipal, id: string) {
    return this.prisma.transaction(async (tx) => {
      const b = await this.load(tx, id);
      user.require('batch.reserve', b.siteId);
      assertTransition(BATCH_TRANSITIONS, 'Batch', b.status, 'MATERIAL_RESERVED');
      const bom = await tx.bom.findFirstOrThrow({ where: { id: b.bomId }, include: { lines: true } });
      const factor = Number(b.plannedQuantity) / Number(bom.batchSize);
      const shortages: BlockingReason[] = [];
      const plan: { materialId: string; allocations: { lotId: string; lotNumber: string; quantity: number }[] }[] = [];
      for (const line of bom.lines) {
        const qty = Math.round(Number(line.quantity) * factor * 10_000) / 10_000;
        const { allocations, shortage } = await this.ledger.allocateFefo(tx, { materialId: line.materialId, siteId: b.siteId, quantity: qty, useBy: b.plannedEnd ?? undefined });
        if (shortage > 0) {
          const m = await tx.material.findFirst({ where: { id: line.materialId } });
          shortages.push({ code: 'INSUFFICIENT_RELEASED_STOCK', message: `${m?.code} ${m?.name}: short by ${shortage} (only released, unexpired stock can be reserved)`, href: `/master-data/materials/${line.materialId}` });
        }
        plan.push({ materialId: line.materialId, allocations });
      }
      if (shortages.length) throw new RuleViolationError('Insufficient released material to reserve this batch', shortages, 'MATERIAL_SHORTAGE');
      for (const p of plan) {
        for (const a of p.allocations) {
          const r = await tx.materialReservation.create({ data: { tenantId: b.tenantId, batchId: b.id, lotId: a.lotId, materialId: p.materialId, quantity: a.quantity } });
          await this.ledger.post(tx, { lotId: a.lotId, type: 'RESERVE', reserved: a.quantity, referenceType: 'Batch', referenceId: b.id, performedById: user.id, reason: `Reserved for ${b.batchNumber} (${r.id})` });
        }
      }
      await this.transition(tx, b, 'MATERIAL_RESERVED');
      return { reservations: plan.flatMap((p) => p.allocations.map((a) => ({ materialId: p.materialId, ...a }))) };
    });
  }

  async unreserve(user: AuthPrincipal, id: string, reason: string) {
    return this.prisma.transaction(async (tx) => {
      const b = await this.load(tx, id);
      user.require('batch.reserve', b.siteId);
      assertTransition(BATCH_TRANSITIONS, 'Batch', b.status, 'PLANNED');
      await this.releaseReservations(tx, b, user.id, reason);
      await this.transition(tx, b, 'PLANNED', {}, reason);
      return { ok: true };
    });
  }

  private async releaseReservations(tx: Tx, b: Batch, userId: string, reason: string) {
    const res = await tx.materialReservation.findMany({ where: { batchId: b.id, status: 'ACTIVE' } });
    for (const r of res) {
      await this.ledger.post(tx, { lotId: r.lotId, type: 'UNRESERVE', reserved: -Number(r.quantity), referenceType: 'Batch', referenceId: b.id, performedById: userId, reason });
      await tx.materialReservation.update({ where: { id: r.id }, data: { status: 'RELEASED' } });
    }
  }

  /** Material issue (dispensing from warehouse). Lots are re-checked: only RELEASED, unexpired stock may be issued. */
  async issue(user: AuthPrincipal, id: string) {
    return this.prisma.transaction(async (tx) => {
      const b = await this.load(tx, id);
      user.require('inventory.issue', b.siteId);
      assertTransition(BATCH_TRANSITIONS, 'Batch', b.status, 'READY');
      const res = await tx.materialReservation.findMany({ where: { batchId: b.id, status: 'ACTIVE' } });
      if (res.length === 0) throw new RuleViolationError('No active reservations to issue');
      const now = new Date();
      for (const r of res) {
        const lot = await tx.inventoryLot.findFirstOrThrow({ where: { id: r.lotId } });
        if (lot.status !== 'RELEASED' || lot.expiryDate <= now || (lot.retestDate && lot.retestDate <= now)) {
          throw new RuleViolationError(`Lot ${lot.lotNumber} is no longer usable (${lot.status}${lot.expiryDate <= now ? ', expired' : ''}). Re-reserve the batch.`, [
            { code: 'LOT_NOT_USABLE', message: lot.lotNumber, href: `/inventory/lots/${lot.id}` },
          ]);
        }
        await this.ledger.post(tx, {
          lotId: r.lotId,
          type: 'ISSUE_TO_PRODUCTION',
          quantity: -Number(r.quantity),
          reserved: -Number(r.quantity),
          referenceType: 'Batch',
          referenceId: b.id,
          performedById: user.id,
          reason: `Issued to ${b.batchNumber}`,
        });
        await tx.materialReservation.update({ where: { id: r.id }, data: { status: 'ISSUED' } });
      }
      await this.transition(tx, b, 'READY');
      return { issued: res.length };
    });
  }

  async start(user: AuthPrincipal, id: string) {
    return this.prisma.transaction(async (tx) => {
      const b = await this.load(tx, id);
      user.require('batch.start', b.siteId);
      const product = await tx.product.findFirstOrThrow({ where: { id: b.productId } });
      const now = new Date();
      const expiry = new Date(now);
      expiry.setMonth(expiry.getMonth() + product.shelfLifeMonths);
      await this.transition(tx, b, 'IN_PROGRESS', { actualStart: now, mfgDate: now, expiryDate: expiry });
      return { status: 'IN_PROGRESS' };
    });
  }

  /**
   * Completes manufacturing: verifies all eBMR steps, computes yield against tolerance,
   * books finished goods into QUARANTINE and requests finished-product QC.
   */
  async complete(user: AuthPrincipal, id: string, dto: CompleteBatchDto) {
    return this.prisma.transaction(async (tx) => {
      const b = await this.load(tx, id);
      user.require('batch.complete', b.siteId);
      assertTransition(BATCH_TRANSITIONS, 'Batch', b.status, 'AWAITING_QC');
      const steps = await tx.batchStep.findMany({ where: { batchId: id }, orderBy: { sequence: 'asc' } });
      const incomplete = steps.filter((s) => s.status === 'PENDING' || s.status === 'IN_PROGRESS' || (s.requiresVerification && s.status !== 'VERIFIED'));
      if (incomplete.length) {
        throw new RuleViolationError(
          'All eBMR steps must be completed and verified',
          incomplete.map((s) => ({ code: 'STEP_INCOMPLETE', message: `${s.sequence} ${s.name}: ${s.status}${s.requiresVerification && s.status === 'COMPLETED' ? ' (awaiting supervisor verification)' : ''}` })),
        );
      }
      const output = steps.filter((s) => s.recordsOutput).reduce((a, s) => a + Number(s.outputQuantity ?? 0), 0);
      if (output <= 0) throw new RuleViolationError('No output quantity recorded');
      const settings = await this.settings.get(b.tenantId, tx);
      const y = calculateYield(Number(b.theoreticalYield), output, settings.yieldTolerance);
      if (!y.withinTolerance) {
        if (dto.yieldDeviationId) {
          const d = await tx.deviation.findFirst({ where: { id: dto.yieldDeviationId } });
          if (!d || d.batchId !== b.id) throw new ValidationError('The yield deviation must be raised against this batch');
        } else if (!dto.yieldJustification) {
          throw new RuleViolationError(
            `Yield ${y.yieldPct}% is outside the ${settings.yieldTolerance.minPct}–${settings.yieldTolerance.maxPct}% tolerance. Raise a deviation or document a justification.`,
            [{ code: 'YIELD_OUT_OF_TOLERANCE', message: `${y.yieldPct}%`, href: `/quality/deviations/new?batchId=${b.id}` }],
            'YIELD_OUT_OF_TOLERANCE',
          );
        }
      }
      const fgWarehouse = await tx.warehouse.findFirst({ where: { siteId: b.siteId, type: 'FINISHED_GOODS', isActive: true }, orderBy: { code: 'asc' } });
      if (!fgWarehouse) throw new RuleViolationError('No finished-goods warehouse configured for this site');
      const product = await tx.product.findFirstOrThrow({ where: { id: b.productId } });
      const lot = await tx.inventoryLot.create({
        data: {
          tenantId: b.tenantId,
          siteId: b.siteId,
          itemType: 'PRODUCT',
          productId: b.productId,
          lotNumber: b.batchNumber,
          batchId: b.id,
          mfgDate: b.mfgDate,
          expiryDate: b.expiryDate ?? new Date(Date.now() + product.shelfLifeMonths * 30 * DAY),
          quantity: output,
          uomCode: b.uomCode,
          warehouseId: fgWarehouse.id,
          status: 'QUARANTINE',
          sourceType: 'BATCH',
          sourceId: b.id,
          unitCost: product.unitPrice,
        },
      });
      await this.ledger.receipt(tx, lot, 'FG_RECEIPT', { referenceType: 'Batch', referenceId: b.id, performedById: user.id });
      await this.transition(
        tx,
        b,
        'AWAITING_QC',
        {
          actualEnd: new Date(),
          actualYield: output,
          yieldPct: y.yieldPct,
          yieldWithinLimits: y.withinTolerance,
          yieldJustification: dto.yieldJustification ?? null,
          yieldDeviationId: dto.yieldDeviationId ?? null,
        },
        y.withinTolerance ? undefined : (dto.yieldJustification ?? 'Yield outside tolerance — deviation linked'),
      );
      await this.sampling.request(tx, {
        tenantId: b.tenantId,
        siteId: b.siteId,
        stage: 'FINISHED_PRODUCT',
        productId: b.productId,
        batchId: b.id,
        lotId: lot.id,
        requestedById: user.id,
        label: `${product.genericName} ${product.strength} batch ${b.batchNumber}`,
      });
      return { yield: y, finishedGoodsLot: lot.lotNumber };
    });
  }

  /** Every condition that blocks QA release. Evaluated inside the release transaction too. */
  async releaseBlockers(tx: Tx, b: Batch): Promise<BlockingReason[]> {
    const reasons: BlockingReason[] = [];
    if (b.status !== 'AWAITING_QA') reasons.push({ code: 'STATUS', message: `Batch is ${b.status}; QA release requires AWAITING_QA` });
    const samples = await tx.qcSample.findMany({ where: { batchId: b.id, stage: 'FINISHED_PRODUCT', status: { not: 'CANCELLED' } } });
    if (samples.length === 0) reasons.push({ code: 'NO_QC', message: 'No finished-product QC sample' });
    for (const s of samples) {
      if (s.status !== 'APPROVED') reasons.push({ code: 'QC_PENDING', message: `QC sample ${s.number} is ${s.status}`, href: `/quality/samples/${s.id}` });
      else if (s.conclusion !== 'PASS') reasons.push({ code: 'QC_FAILED', message: `QC sample ${s.number} concluded ${s.conclusion}`, href: `/quality/samples/${s.id}` });
    }
    const oos = await tx.oosInvestigation.findMany({ where: { batchId: b.id, OR: [{ status: { in: OPEN_OOS_STATUSES } }, { conclusion: 'CONFIRMED_OOS' }] } });
    for (const o of oos) reasons.push({ code: 'OOS', message: `OOS ${o.number} — ${o.testName} (${o.status === 'CLOSED' ? 'confirmed OOS' : o.status})`, href: `/quality/oos/${o.id}` });
    const devs = await tx.deviation.findMany({ where: { batchId: b.id, status: { in: OPEN_DEVIATION_STATUSES } } });
    for (const d of devs) reasons.push({ code: 'OPEN_DEVIATION', message: `Deviation ${d.number} is ${d.status}`, href: `/quality/deviations/${d.id}` });
    const steps = await tx.batchStep.findMany({ where: { batchId: b.id } });
    const unverified = steps.filter((s) => s.requiresVerification && s.status !== 'VERIFIED');
    if (unverified.length) reasons.push({ code: 'EBMR_INCOMPLETE', message: `${unverified.length} eBMR step(s) not verified` });
    if (b.yieldWithinLimits === false && !b.yieldJustification && !b.yieldDeviationId) reasons.push({ code: 'YIELD', message: 'Yield out of tolerance without justification' });
    return reasons;
  }

  async getReleaseBlockers(id: string) {
    return this.prisma.transaction(async (tx) => this.releaseBlockers(tx, await this.load(tx, id)));
  }

  /**
   * QA batch disposition — single transaction:
   * permission → status → QC → OOS → deviations → eBMR → yield → e-signature → batch status →
   * finished goods status → audit → notification. Any failure rolls everything back.
   */
  async qaDecision(user: AuthPrincipal, id: string, dto: QaDecisionDto) {
    return this.prisma.transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM batches WHERE id = ${id}::uuid FOR UPDATE`;
        const b = await this.load(tx, id);
        user.require('batch.approve', b.siteId);
        if (b.status !== 'AWAITING_QA') throw new ConflictError(`Batch ${b.batchNumber} is ${b.status}; QA decision requires AWAITING_QA`, { reasons: await this.releaseBlockers(tx, b) }, 'RELEASE_BLOCKED');
        if (dto.decision === 'RELEASE') {
          const blockers = await this.releaseBlockers(tx, b);
          if (blockers.length) throw new RuleViolationError(`Batch ${b.batchNumber} cannot be released`, blockers, 'RELEASE_BLOCKED');
        } else if (!dto.reason || dto.reason.trim().length < 5) {
          throw new ValidationError('A reason is required to reject a batch');
        }
        const product = await tx.product.findFirstOrThrow({ where: { id: b.productId } });
        const signature = await this.signatures.sign(tx, user, dto, {
          entityType: 'Batch',
          entityId: b.id,
          entityLabel: b.batchNumber,
          action: dto.decision === 'RELEASE' ? 'BATCH_QA_RELEASE' : 'BATCH_QA_REJECT',
          meaning:
            dto.decision === 'RELEASE'
              ? `QA release: batch ${b.batchNumber} reviewed against the batch record and specifications and released for distribution`
              : `QA rejection: batch ${b.batchNumber} rejected and must not be distributed`,
          record: b,
        });
        const statusTo = dto.decision === 'RELEASE' ? 'RELEASED' : 'REJECTED';
        await this.transition(tx, b, statusTo, { qaDecisionById: user.id, qaDecisionAt: new Date(), qaDecisionComment: dto.reason ?? null }, dto.reason);
        const lots = await tx.inventoryLot.findMany({ where: { batchId: b.id, itemType: 'PRODUCT', status: { in: ['QUARANTINE', 'UNDER_TEST'] } } });
        for (const lot of lots) {
          await this.ledger.post(tx, {
            lotId: lot.id,
            type: 'STATUS_CHANGE',
            statusTo,
            referenceType: 'ElectronicSignature',
            referenceId: signature.id,
            performedById: user.id,
            reason: `QA ${dto.decision.toLowerCase()} of batch ${b.batchNumber}`,
            set: { dispositionById: user.id, dispositionAt: new Date() },
          });
        }
        await this.audit.record(tx, {
          entityType: 'Batch',
          entityId: b.id,
          entityLabel: b.batchNumber,
          action: dto.decision === 'RELEASE' ? 'APPROVE' : 'REJECT',
          previous: { status: b.status },
          next: { status: statusTo, finishedGoodsLots: lots.map((l) => l.lotNumber) },
          reason: dto.reason,
          signatureId: signature.id,
        });
        await this.notifications.notify(tx, {
          tenantId: b.tenantId,
          event: 'BATCH_RELEASED',
          severity: dto.decision === 'RELEASE' ? 'INFO' : 'WARNING',
          title: `Batch ${b.batchNumber} ${statusTo.toLowerCase()}`,
          body: `${product.genericName} ${product.strength}: QA ${dto.decision.toLowerCase()} by ${user.fullName}.`,
          entityType: 'Batch',
          entityId: b.id,
          link: `/production/batches/${b.id}`,
          permission: 'production.plan.view',
          siteId: b.siteId,
        });
        return { status: statusTo, signatureId: signature.id };
      },
      { timeout: 30_000 },
    );
  }

  async close(user: AuthPrincipal, id: string) {
    return this.prisma.transaction(async (tx) => {
      const b = await this.load(tx, id);
      user.require('batch.approve', b.siteId);
      await this.transition(tx, b, 'CLOSED');
      return { status: 'CLOSED' };
    });
  }

  async cancel(user: AuthPrincipal, id: string, reason: string) {
    return this.prisma.transaction(async (tx) => {
      const b = await this.load(tx, id);
      user.require('batch.create', b.siteId);
      assertTransition(BATCH_TRANSITIONS, 'Batch', b.status, 'CANCELLED');
      await this.releaseReservations(tx, b, user.id, reason);
      const issued = await tx.materialReservation.findMany({ where: { batchId: b.id, status: 'ISSUED' } });
      for (const r of issued) {
        await this.ledger.post(tx, { lotId: r.lotId, type: 'RETURN_FROM_PRODUCTION', quantity: Number(r.quantity), referenceType: 'Batch', referenceId: b.id, performedById: user.id, reason: `Batch cancelled: ${reason}` });
        await tx.materialReservation.update({ where: { id: r.id }, data: { status: 'RELEASED' } });
      }
      await this.transition(tx, b, 'CANCELLED', {}, reason);
      return { status: 'CANCELLED' };
    });
  }
}
