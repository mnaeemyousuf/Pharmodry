import { Injectable } from '@nestjs/common';
import { InventoryStatus, Prisma } from '@prisma/client';
import { OPEN_OOS_STATUSES, type BlockingReason } from '@pharmodry/types';
import { AuthPrincipal } from '../../common/auth-user';
import { ConflictError, NotFoundError, RuleViolationError, ValidationError } from '../../common/errors';
import { FilterQueryDto, orderBy, pageArgs, statusFilter, toPage } from '../../common/pagination';
import { PrismaService, Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UserDirectory } from '../core/core.services';
import { SignatureService } from '../signatures/signature.service';
import { AdjustDto, BlockDto, DispositionDto, TransferDto } from './inventory.dto';
import { InventoryLedger } from './ledger.service';

const DAY = 86_400_000;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedger,
    private readonly audit: AuditService,
    private readonly signatures: SignatureService,
    private readonly users: UserDirectory,
  ) {}

  private viewFilter(view?: string): Prisma.InventoryLotWhereInput {
    const now = new Date();
    switch (view) {
      case 'expired':
        return { OR: [{ status: 'EXPIRED' }, { expiryDate: { lte: now } }], quantity: { gt: 0 } };
      case 'expiring30':
      case 'expiring60':
      case 'expiring90': {
        const days = Number(view.replace('expiring', ''));
        return { expiryDate: { gt: now, lte: new Date(now.getTime() + days * DAY) }, quantity: { gt: 0 }, status: { notIn: ['REJECTED', 'EXPIRED'] } };
      }
      case 'awaitingDisposition':
        return { status: { in: ['QUARANTINE', 'UNDER_TEST'] }, itemType: 'MATERIAL', quantity: { gt: 0 } };
      case 'available':
        return { status: 'RELEASED', quantity: { gt: 0 }, expiryDate: { gt: now } };
      default:
        return {};
    }
  }

  async listLots(q: FilterQueryDto) {
    const where: Prisma.InventoryLotWhereInput = {
      AND: [
        this.viewFilter(q.view),
        {
          status: statusFilter<InventoryStatus>(q),
          itemType: (q.itemType as 'MATERIAL' | 'PRODUCT') || undefined,
          materialId: q.materialId || undefined,
          productId: q.productId || undefined,
          warehouseId: q.warehouseId || undefined,
          siteId: q.siteId || undefined,
          batchId: q.batchId || undefined,
          ...(q.q ? { OR: [{ lotNumber: { contains: q.q, mode: 'insensitive' } }, { supplierBatch: { contains: q.q, mode: 'insensitive' } }] } : {}),
          ...(q.view ? {} : { quantity: { gt: 0 } }),
        },
      ],
    };
    const [rows, total, agg] = await Promise.all([
      this.prisma.db.inventoryLot.findMany({ where, orderBy: orderBy(q, ['lotNumber', 'expiryDate', 'quantity', 'status', 'createdAt'], { expiryDate: 'asc' }), ...pageArgs(q) }),
      this.prisma.db.inventoryLot.count({ where }),
      this.prisma.db.inventoryLot.findMany({ where, select: { quantity: true, unitCost: true } }),
    ]);
    const value = agg.reduce((a, l) => a + Number(l.quantity) * Number(l.unitCost), 0);
    const page = toPage(await this.enrich(rows), total, q);
    return { data: page.data, meta: { ...page.meta, totalValue: Math.round(value) } };
  }

  /** Adds item, warehouse and bin labels to lots. */
  async enrich<T extends { materialId: string | null; productId: string | null; warehouseId: string; binId: string | null; expiryDate: Date }>(lots: T[]) {
    const [materials, products, warehouses, bins] = await Promise.all([
      this.prisma.db.material.findMany({ where: { id: { in: lots.map((l) => l.materialId).filter(Boolean) as string[] } }, select: { id: true, code: true, name: true, type: true } }),
      this.prisma.db.product.findMany({ where: { id: { in: lots.map((l) => l.productId).filter(Boolean) as string[] } }, select: { id: true, code: true, genericName: true, strength: true } }),
      this.prisma.db.warehouse.findMany({ where: { id: { in: lots.map((l) => l.warehouseId) } }, select: { id: true, code: true, name: true } }),
      this.prisma.db.binLocation.findMany({ where: { id: { in: lots.map((l) => l.binId).filter(Boolean) as string[] } }, select: { id: true, code: true } }),
    ]);
    const m = new Map(materials.map((x) => [x.id, x]));
    const p = new Map(products.map((x) => [x.id, x]));
    const w = new Map(warehouses.map((x) => [x.id, x]));
    const b = new Map(bins.map((x) => [x.id, x]));
    const now = Date.now();
    return lots.map((l) => {
      const mat = l.materialId ? m.get(l.materialId) : undefined;
      const prod = l.productId ? p.get(l.productId) : undefined;
      return {
        ...l,
        item: mat ? { id: mat.id, code: mat.code, name: mat.name, kind: mat.type } : prod ? { id: prod.id, code: prod.code, name: `${prod.genericName} ${prod.strength}`, kind: 'FINISHED_GOOD' } : null,
        warehouse: w.get(l.warehouseId) ?? null,
        bin: l.binId ? (b.get(l.binId) ?? null) : null,
        daysToExpiry: Math.floor((l.expiryDate.getTime() - now) / DAY),
      };
    });
  }

  async getLot(id: string) {
    const lot = await this.prisma.db.inventoryLot.findFirst({ where: { id } });
    if (!lot) throw new NotFoundError('Inventory lot', id);
    const [enriched] = await this.enrich([lot]);
    const [transactions, samples, oos, reservations, consumptions, siblings, supplier] = await Promise.all([
      this.prisma.db.inventoryTransaction.findMany({ where: { lotId: id }, orderBy: { performedAt: 'desc' } }),
      this.prisma.db.qcSample.findMany({ where: { OR: [{ lotId: id }, ...(lot.batchId ? [{ batchId: lot.batchId }] : [])] }, orderBy: { createdAt: 'desc' } }),
      this.prisma.db.oosInvestigation.findMany({ where: { OR: [{ lotId: id }, ...(lot.batchId ? [{ batchId: lot.batchId }] : [])] }, select: { id: true, number: true, status: true, testName: true } }),
      this.prisma.db.materialReservation.findMany({ where: { lotId: id } }),
      this.prisma.db.batchMaterialConsumption.findMany({ where: { lotId: id } }),
      this.prisma.db.inventoryLot.findMany({ where: { lotNumber: lot.lotNumber, id: { not: id } }, select: { id: true, warehouseId: true, quantity: true, status: true } }),
      lot.supplierId ? this.prisma.db.supplier.findFirst({ where: { id: lot.supplierId }, select: { id: true, code: true, name: true } }) : null,
    ]);
    const batchIds = [...new Set([...reservations.map((r) => r.batchId), ...consumptions.map((c) => c.batchId), ...(lot.batchId ? [lot.batchId] : [])])];
    const batches = await this.prisma.db.batch.findMany({ where: { id: { in: batchIds } }, select: { id: true, batchNumber: true, status: true, productId: true } });
    return {
      ...enriched,
      supplier,
      transactions: await this.users.decorate(transactions, ['performedById']),
      samples,
      oos,
      reservations,
      siblings,
      usedInBatches: batches,
      dispositionByName: (await this.users.names([lot.dispositionById]))[lot.dispositionById ?? ''] ?? null,
    };
  }

  async movements(q: FilterQueryDto) {
    const where: Prisma.InventoryTransactionWhereInput = {
      lotId: q.lotId || undefined,
      type: (q.type as Prisma.EnumInventoryTxnTypeFilter['equals']) || undefined,
      performedAt: q.from || q.to ? { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } : undefined,
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.inventoryTransaction.findMany({ where, orderBy: { performedAt: 'desc' }, include: { lot: { select: { lotNumber: true, materialId: true, productId: true } } }, ...pageArgs(q) }),
      this.prisma.db.inventoryTransaction.count({ where }),
    ]);
    return toPage(await this.users.decorate(rows, ['performedById']), total, q);
  }

  async transfer(user: AuthPrincipal, lotId: string, dto: TransferDto) {
    return this.prisma.transaction(async (tx) => {
      const lot = await tx.inventoryLot.findFirst({ where: { id: lotId } });
      if (!lot) throw new NotFoundError('Inventory lot', lotId);
      user.require('inventory.transfer', lot.siteId);
      const available = Number(lot.quantity) - Number(lot.reservedQuantity);
      if (dto.quantity > available) throw new RuleViolationError(`Only ${available} ${lot.uomCode} available (unreserved) to transfer`);
      const to = await tx.warehouse.findFirst({ where: { id: dto.toWarehouseId, siteId: lot.siteId } });
      if (!to) throw new ValidationError('Destination warehouse not found at this site (inter-site transfer is a post-MVP workflow)');
      if (to.id === lot.warehouseId && (dto.toBinId ?? null) === lot.binId) throw new ValidationError('Source and destination are the same');
      if (dto.toBinId && !(await tx.binLocation.findFirst({ where: { id: dto.toBinId, warehouseId: to.id } }))) throw new ValidationError('Bin does not belong to destination warehouse');
      await this.ledger.post(tx, { lotId, type: 'TRANSFER_OUT', quantity: -dto.quantity, referenceType: 'Transfer', reason: dto.reason, performedById: user.id });
      const existing = await tx.inventoryLot.findFirst({ where: { lotNumber: lot.lotNumber, warehouseId: to.id, binId: dto.toBinId ?? null, status: lot.status } });
      let target;
      if (existing) {
        target = await this.ledger.post(tx, { lotId: existing.id, type: 'TRANSFER_IN', quantity: dto.quantity, referenceType: 'Transfer', referenceId: lot.id, reason: dto.reason, performedById: user.id });
      } else {
        const { id: _id, createdAt: _c, updatedAt: _u, version: _v, quantity: _q, reservedQuantity: _r, ...copy } = lot;
        target = await tx.inventoryLot.create({ data: { ...copy, warehouseId: to.id, binId: dto.toBinId ?? null, quantity: dto.quantity, sourceType: 'TRANSFER', sourceId: lot.id } });
        await this.ledger.receipt(tx, target, 'TRANSFER_IN', { referenceType: 'Transfer', referenceId: lot.id, performedById: user.id });
      }
      await this.audit.record(tx, { entityType: 'InventoryLot', entityId: lot.id, entityLabel: lot.lotNumber, action: 'UPDATE', next: { transferred: dto.quantity, toWarehouse: to.code, toLotRecord: target.id }, reason: dto.reason });
      return target;
    });
  }

  async adjust(user: AuthPrincipal, lotId: string, dto: AdjustDto) {
    if (dto.quantity === 0) throw new ValidationError('Adjustment quantity cannot be zero');
    return this.prisma.transaction(async (tx) => {
      const lot = await tx.inventoryLot.findFirst({ where: { id: lotId } });
      if (!lot) throw new NotFoundError('Inventory lot', lotId);
      user.require('inventory.adjust', lot.siteId);
      const after = await this.ledger.post(tx, { lotId, type: 'ADJUSTMENT', quantity: dto.quantity, reason: dto.reason, performedById: user.id, referenceType: 'Adjustment' });
      await this.audit.record(tx, { entityType: 'InventoryLot', entityId: lotId, entityLabel: lot.lotNumber, action: 'UPDATE', previous: { quantity: lot.quantity }, next: { quantity: after.quantity }, reason: dto.reason });
      return after;
    });
  }

  /** Reasons a material lot cannot be released yet (used by UI and enforced server-side). */
  async releaseBlockers(tx: Tx, lotId: string): Promise<BlockingReason[]> {
    const lot = await tx.inventoryLot.findFirstOrThrow({ where: { id: lotId } });
    const reasons: BlockingReason[] = [];
    if (lot.expiryDate <= new Date()) reasons.push({ code: 'EXPIRED', message: 'Lot is past its expiry date' });
    const sample = await tx.qcSample.findFirst({ where: { lotId, status: { not: 'CANCELLED' } }, orderBy: { createdAt: 'desc' } });
    if (!sample) reasons.push({ code: 'NO_QC_SAMPLE', message: 'No QC sample exists for this lot' });
    else if (sample.status !== 'APPROVED') reasons.push({ code: 'QC_NOT_APPROVED', message: `QC sample ${sample.number} is ${sample.status}`, href: `/quality/samples/${sample.id}` });
    else if (sample.conclusion !== 'PASS') reasons.push({ code: 'QC_FAILED', message: `QC sample ${sample.number} concluded ${sample.conclusion}`, href: `/quality/samples/${sample.id}` });
    const oos = await tx.oosInvestigation.findMany({ where: { lotId, OR: [{ status: { in: OPEN_OOS_STATUSES } }, { conclusion: 'CONFIRMED_OOS' }] } });
    for (const o of oos) reasons.push({ code: 'OOS', message: `OOS ${o.number} (${o.status === 'CLOSED' ? 'confirmed' : 'open'})`, href: `/quality/oos/${o.id}` });
    return reasons;
  }

  async getReleaseBlockers(lotId: string) {
    return this.prisma.transaction((tx) => this.releaseBlockers(tx, lotId));
  }

  /** QA disposition of a material lot. Release requires approved passing QC, no OOS, e-signature. */
  async disposition(user: AuthPrincipal, lotId: string, dto: DispositionDto) {
    return this.prisma.transaction(async (tx) => {
      const lot = await tx.inventoryLot.findFirst({ where: { id: lotId } });
      if (!lot) throw new NotFoundError('Inventory lot', lotId);
      user.require('inventory.release', lot.siteId);
      if (lot.itemType !== 'MATERIAL') throw new RuleViolationError('Finished goods are dispositioned through QA batch release');
      if (!['QUARANTINE', 'UNDER_TEST'].includes(lot.status)) throw new ConflictError(`Lot ${lot.lotNumber} is ${lot.status} and cannot be dispositioned`);
      if (dto.decision === 'RELEASE') {
        const blockers = await this.releaseBlockers(tx, lotId);
        if (blockers.length) throw new RuleViolationError(`Lot ${lot.lotNumber} cannot be released`, blockers, 'RELEASE_BLOCKED');
      } else if (!dto.reason || dto.reason.trim().length < 5) {
        throw new ValidationError('A reason is required to reject a lot');
      }
      const statusTo = dto.decision === 'RELEASE' ? 'RELEASED' : 'REJECTED';
      const signature = await this.signatures.sign(tx, user, dto, {
        entityType: 'InventoryLot',
        entityId: lot.id,
        entityLabel: lot.lotNumber,
        action: dto.decision === 'RELEASE' ? 'LOT_QA_RELEASE' : 'LOT_QA_REJECT',
        meaning: dto.decision === 'RELEASE' ? 'QA approval: material lot released for use in manufacturing' : 'QA decision: material lot rejected',
        record: lot,
      });
      // Apply to every location record of this lot number that is still awaiting disposition.
      const siblings = await tx.inventoryLot.findMany({ where: { lotNumber: lot.lotNumber, status: { in: ['QUARANTINE', 'UNDER_TEST'] } } });
      for (const s of siblings) {
        await this.ledger.post(tx, {
          lotId: s.id,
          type: 'STATUS_CHANGE',
          statusTo,
          referenceType: 'ElectronicSignature',
          referenceId: signature.id,
          reason: dto.reason,
          performedById: user.id,
          set: { dispositionById: user.id, dispositionAt: new Date() },
        });
      }
      await this.audit.record(tx, {
        entityType: 'InventoryLot',
        entityId: lot.id,
        entityLabel: lot.lotNumber,
        action: dto.decision === 'RELEASE' ? 'APPROVE' : 'REJECT',
        previous: { status: lot.status },
        next: { status: statusTo },
        reason: dto.reason,
        signatureId: signature.id,
      });
      return { lotNumber: lot.lotNumber, status: statusTo, signatureId: signature.id };
    });
  }

  async block(user: AuthPrincipal, lotId: string, dto: BlockDto) {
    return this.prisma.transaction(async (tx) => {
      const lot = await tx.inventoryLot.findFirst({ where: { id: lotId } });
      if (!lot) throw new NotFoundError('Inventory lot', lotId);
      user.require('inventory.release', lot.siteId);
      if (dto.action === 'BLOCK') {
        if (lot.status !== 'RELEASED') throw new ConflictError('Only released lots can be blocked');
        if (Number(lot.reservedQuantity) > 0) throw new ConflictError('Lot has active reservations; release them first');
      } else if (lot.status !== 'BLOCKED') {
        throw new ConflictError('Lot is not blocked');
      }
      const statusTo = dto.action === 'BLOCK' ? 'BLOCKED' : 'RELEASED';
      await this.ledger.post(tx, { lotId, type: 'STATUS_CHANGE', statusTo, reason: dto.reason, performedById: user.id });
      await this.audit.record(tx, { entityType: 'InventoryLot', entityId: lotId, entityLabel: lot.lotNumber, action: 'STATUS_CHANGE', previous: { status: lot.status }, next: { status: statusTo }, reason: dto.reason });
      return { status: statusTo };
    });
  }

  /** Stock summary per material at RELEASED / quarantine, with safety stock comparison. */
  async stockSummary(siteId?: string) {
    const materials = await this.prisma.db.material.findMany({ where: { status: 'ACTIVE' }, orderBy: { code: 'asc' } });
    const groups = await this.prisma.db.inventoryLot.groupBy({
      by: ['materialId', 'status'],
      where: { itemType: 'MATERIAL', siteId: siteId || undefined, quantity: { gt: 0 } },
      _sum: { quantity: true, reservedQuantity: true },
    });
    return materials.map((m) => {
      const g = groups.filter((x) => x.materialId === m.id);
      const of = (s: InventoryStatus[]) => g.filter((x) => s.includes(x.status)).reduce((a, x) => a + Number(x._sum.quantity ?? 0), 0);
      const reserved = g.filter((x) => x.status === 'RELEASED').reduce((a, x) => a + Number(x._sum.reservedQuantity ?? 0), 0);
      const released = of(['RELEASED']);
      return {
        materialId: m.id,
        code: m.code,
        name: m.name,
        type: m.type,
        released,
        available: released - reserved,
        reserved,
        quarantine: of(['QUARANTINE', 'UNDER_TEST']),
        rejected: of(['REJECTED', 'BLOCKED', 'EXPIRED']),
        safetyStock: Number(m.safetyStock),
        belowSafetyStock: released - reserved < Number(m.safetyStock),
      };
    });
  }
}
