import { Injectable } from '@nestjs/common';
import { InventoryLot, InventoryStatus, InventoryTxnType, Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, RuleViolationError } from '../../common/errors';
import { Tx } from '../../infrastructure/prisma/prisma.service';

export interface Movement {
  lotId: string;
  type: InventoryTxnType;
  /** Signed change to on-hand quantity (0 for status changes / reservations). */
  quantity?: number;
  /** Signed change to reserved quantity. */
  reserved?: number;
  statusTo?: InventoryStatus;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  performedById?: string;
  /** Extra lot fields to set (e.g. disposition). */
  set?: Prisma.InventoryLotUpdateManyMutationInput;
}

export interface Allocation {
  lotId: string;
  lotNumber: string;
  quantity: number;
  expiryDate: Date;
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * The only component allowed to change lot quantities or statuses. Every change writes an
 * InventoryTransaction (append-only) and uses optimistic locking on the lot `version`.
 */
@Injectable()
export class InventoryLedger {
  async post(tx: Tx, m: Movement): Promise<InventoryLot> {
    const lot = await tx.inventoryLot.findFirst({ where: { id: m.lotId } });
    if (!lot) throw new NotFoundError('Inventory lot', m.lotId);
    const qty = round4(Number(lot.quantity) + (m.quantity ?? 0));
    const reserved = round4(Number(lot.reservedQuantity) + (m.reserved ?? 0));
    if (qty < 0) throw new RuleViolationError(`Insufficient quantity in lot ${lot.lotNumber}: on hand ${lot.quantity}, requested ${-(m.quantity ?? 0)}`);
    if (reserved < 0 || reserved > qty) throw new RuleViolationError(`Reservation would exceed available quantity in lot ${lot.lotNumber}`);
    const res = await tx.inventoryLot.updateMany({
      where: { id: lot.id, version: lot.version },
      data: { quantity: qty, reservedQuantity: reserved, status: m.statusTo ?? undefined, version: { increment: 1 }, ...(m.set ?? {}) },
    });
    if (res.count !== 1) throw new ConflictError(`Lot ${lot.lotNumber} was modified concurrently; retry`, undefined, 'CONCURRENT_MODIFICATION');
    await tx.inventoryTransaction.create({
      data: {
        tenantId: lot.tenantId,
        siteId: lot.siteId,
        lotId: lot.id,
        type: m.type,
        quantity: m.quantity ?? (m.reserved ?? 0),
        balanceAfter: qty,
        statusFrom: m.statusTo ? lot.status : null,
        statusTo: m.statusTo ?? null,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        reason: m.reason,
        performedById: m.performedById,
      },
    });
    return { ...lot, quantity: new Prisma.Decimal(qty), reservedQuantity: new Prisma.Decimal(reserved), status: m.statusTo ?? lot.status, version: lot.version + 1 };
  }

  /** Records the initial receipt transaction for a newly created lot. */
  async receipt(tx: Tx, lot: InventoryLot, type: InventoryTxnType, ref: { referenceType: string; referenceId: string; performedById: string }) {
    await tx.inventoryTransaction.create({
      data: {
        tenantId: lot.tenantId,
        siteId: lot.siteId,
        lotId: lot.id,
        type,
        quantity: lot.quantity,
        balanceAfter: lot.quantity,
        statusTo: lot.status,
        ...ref,
      },
    });
  }

  /**
   * First-Expiry-First-Out allocation over RELEASED, unexpired, not-retest-due lots.
   * Unreleased material can never be allocated (pharma rule #3).
   */
  async allocateFefo(tx: Tx, p: { materialId: string; siteId: string; quantity: number; useBy?: Date }): Promise<{ allocations: Allocation[]; shortage: number }> {
    const now = p.useBy ?? new Date();
    const lots = await tx.inventoryLot.findMany({
      where: {
        materialId: p.materialId,
        siteId: p.siteId,
        status: 'RELEASED',
        expiryDate: { gt: now },
        OR: [{ retestDate: null }, { retestDate: { gt: now } }],
        quantity: { gt: 0 },
      },
      orderBy: [{ expiryDate: 'asc' }, { retestDate: 'asc' }, { createdAt: 'asc' }],
    });
    let remaining = round4(p.quantity);
    const allocations: Allocation[] = [];
    for (const lot of lots) {
      if (remaining <= 0) break;
      const available = round4(Number(lot.quantity) - Number(lot.reservedQuantity));
      if (available <= 0) continue;
      const take = Math.min(available, remaining);
      allocations.push({ lotId: lot.id, lotNumber: lot.lotNumber, quantity: round4(take), expiryDate: lot.expiryDate });
      remaining = round4(remaining - take);
    }
    return { allocations, shortage: Math.max(0, remaining) };
  }
}
