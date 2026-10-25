import { Controller, Get, Injectable, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { gs1ElementString } from '@pharmodry/types';
import { RequirePermissions } from '../../common/auth-user';
import { sendCsv, toCsv } from '../../common/csv';
import { NotFoundError } from '../../common/errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UserDirectory } from '../core/core.services';

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Lot / batch genealogy for recalls and investigations. Backward: which supplier lots went into a
 * batch. Forward: which batches (and finished-goods lots) used a material lot. Mock recall: where every
 * unit of a batch is now. Distribution to customers is not captured in this release (ERP/distribution).
 */
@Injectable()
export class TraceabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UserDirectory,
  ) {}

  async search(q: string) {
    const term = q.trim();
    if (term.length < 2) return [];
    const [batches, lots] = await Promise.all([
      this.prisma.db.batch.findMany({ where: { batchNumber: { contains: term, mode: 'insensitive' } }, take: 10, include: { product: { select: { genericName: true, strength: true } } } }),
      this.prisma.db.inventoryLot.findMany({ where: { itemType: 'MATERIAL', OR: [{ lotNumber: { contains: term, mode: 'insensitive' } }, { supplierBatch: { contains: term, mode: 'insensitive' } }] }, take: 10 }),
    ]);
    return [
      ...batches.map((b) => ({ type: 'batch', id: b.id, label: b.batchNumber, sub: `${b.product.genericName} ${b.product.strength} · ${b.status}` })),
      ...lots.map((l) => ({ type: 'lot', id: l.id, label: l.lotNumber, sub: `Supplier batch ${l.supplierBatch ?? '—'} · ${l.status}` })),
    ];
  }

  /** Forward trace from a material lot (all location records sharing its lot number). */
  async forwardFromLot(lotId: string) {
    const lot = await this.prisma.db.inventoryLot.findFirst({ where: { id: lotId } });
    if (!lot) throw new NotFoundError('Inventory lot', lotId);
    const siblings = await this.prisma.db.inventoryLot.findMany({ where: { lotNumber: lot.lotNumber } });
    const ids = siblings.map((s) => s.id);
    const [material, supplier, grnLine, consumptions, reservations] = await Promise.all([
      lot.materialId ? this.prisma.db.material.findFirst({ where: { id: lot.materialId }, select: { id: true, code: true, name: true } }) : null,
      lot.supplierId ? this.prisma.db.supplier.findFirst({ where: { id: lot.supplierId }, select: { id: true, code: true, name: true } }) : null,
      this.prisma.db.goodsReceiptLine.findFirst({ where: { lotId: { in: ids } }, include: { goodsReceipt: { select: { id: true, number: true, receivedAt: true } } } }),
      this.prisma.db.batchMaterialConsumption.findMany({ where: { lotId: { in: ids } } }),
      this.prisma.db.materialReservation.findMany({ where: { lotId: { in: ids }, status: { in: ['ACTIVE', 'ISSUED'] } } }),
    ]);
    const batchIds = [...new Set([...consumptions.map((c) => c.batchId), ...reservations.map((r) => r.batchId)])];
    const [batches, fgLots] = await Promise.all([
      this.prisma.db.batch.findMany({ where: { id: { in: batchIds } }, include: { product: { select: { code: true, genericName: true, strength: true } } } }),
      this.prisma.db.inventoryLot.findMany({ where: { batchId: { in: batchIds }, itemType: 'PRODUCT' } }),
    ]);
    const dispatched = await this.dispatchedByLot(fgLots.map((l) => l.id));
    return {
      lot: { id: lot.id, lotNumber: lot.lotNumber, status: lot.status, supplierBatch: lot.supplierBatch, expiryDate: lot.expiryDate, uom: lot.uomCode, onHand: r3(siblings.reduce((a, s) => a + Number(s.quantity), 0)) },
      material,
      supplier,
      receipt: grnLine ? { id: grnLine.goodsReceipt.id, number: grnLine.goodsReceipt.number, receivedAt: grnLine.goodsReceipt.receivedAt, quantity: Number(grnLine.quantity) } : null,
      batches: batches.map((b) => ({
        id: b.id,
        batchNumber: b.batchNumber,
        status: b.status,
        product: `${b.product.code} ${b.product.genericName} ${b.product.strength}`,
        quantityUsed: r3(consumptions.filter((c) => c.batchId === b.id).reduce((a, c) => a + Number(c.actualQuantity), 0)),
        reservedNotYetConsumed: r3(reservations.filter((r) => r.batchId === b.id && !consumptions.some((c) => c.batchId === b.id)).reduce((a, r) => a + Number(r.quantity), 0)),
        finishedGoods: fgLots
          .filter((f) => f.batchId === b.id)
          .map((f) => ({ id: f.id, lotNumber: f.lotNumber, status: f.status, onHand: Number(f.quantity), dispatched: dispatched[f.id] ?? 0, uom: f.uomCode })),
      })),
    };
  }

  /** Backward genealogy of a batch: inputs, supplier lots, GRNs. */
  async backwardFromBatch(batchId: string) {
    const b = await this.prisma.db.batch.findFirst({ where: { id: batchId }, include: { product: true } });
    if (!b) throw new NotFoundError('Batch', batchId);
    const [consumptions, reservations] = await Promise.all([
      this.prisma.db.batchMaterialConsumption.findMany({ where: { batchId } }),
      this.prisma.db.materialReservation.findMany({ where: { batchId, status: { in: ['ACTIVE', 'ISSUED'] } } }),
    ]);
    const lotIds = [...new Set([...consumptions.map((c) => c.lotId), ...reservations.map((r) => r.lotId)])];
    const lots = await this.prisma.db.inventoryLot.findMany({ where: { id: { in: lotIds } } });
    const [materials, suppliers, grnLines, samples] = await Promise.all([
      this.prisma.db.material.findMany({ where: { id: { in: lots.map((l) => l.materialId).filter(Boolean) as string[] } }, select: { id: true, code: true, name: true, type: true } }),
      this.prisma.db.supplier.findMany({ where: { id: { in: lots.map((l) => l.supplierId).filter(Boolean) as string[] } }, select: { id: true, code: true, name: true } }),
      this.prisma.db.goodsReceiptLine.findMany({ where: { lotId: { in: lots.map((l) => l.id) } }, include: { goodsReceipt: { select: { id: true, number: true } } } }),
      this.prisma.db.qcSample.findMany({ where: { lotId: { in: lotIds }, status: 'APPROVED' }, select: { id: true, number: true, lotId: true, conclusion: true } }),
    ]);
    return {
      batch: { id: b.id, batchNumber: b.batchNumber, status: b.status, product: `${b.product.code} ${b.product.genericName} ${b.product.strength}`, gs1: b.product.gtin && b.expiryDate ? gs1ElementString(b.product.gtin, b.expiryDate, b.batchNumber) : null },
      inputs: lots.map((l) => {
        const m = materials.find((x) => x.id === l.materialId);
        const s = suppliers.find((x) => x.id === l.supplierId);
        const grn = grnLines.find((g) => g.lotId === l.id);
        const used = consumptions.filter((c) => c.lotId === l.id).reduce((a, c) => a + Number(c.actualQuantity), 0);
        return {
          lotId: l.id,
          lotNumber: l.lotNumber,
          material: m ? `${m.code} ${m.name}` : '—',
          materialType: m?.type,
          supplier: s ? `${s.code} ${s.name}` : 'Legacy / migrated',
          supplierBatch: l.supplierBatch,
          grn: grn ? { id: grn.goodsReceipt.id, number: grn.goodsReceipt.number } : null,
          qcRelease: samples.find((x) => x.lotId === l.id) ?? null,
          quantityUsed: r3(used),
          reserved: r3(reservations.filter((r) => r.lotId === l.id).reduce((a, r) => a + Number(r.quantity), 0)),
          uom: l.uomCode,
          lotStatusNow: l.status,
        };
      }),
    };
  }

  private async dispatchedByLot(lotIds: string[]) {
    if (!lotIds.length) return {} as Record<string, number>;
    const tx = await this.prisma.db.inventoryTransaction.groupBy({ by: ['lotId'], where: { lotId: { in: lotIds }, type: 'DISPATCH' }, _sum: { quantity: true } });
    return Object.fromEntries(tx.map((t) => [t.lotId, -Number(t._sum.quantity ?? 0)]));
  }

  /** Mock / real recall reconciliation for a batch: produced = on hand + dispatched + other movements. */
  async recall(batchId: string) {
    const b = await this.prisma.db.batch.findFirst({ where: { id: batchId }, include: { product: true } });
    if (!b) throw new NotFoundError('Batch', batchId);
    const fgLots = await this.prisma.db.inventoryLot.findMany({ where: { batchId, itemType: 'PRODUCT' } });
    const txns = await this.prisma.db.inventoryTransaction.findMany({ where: { lotId: { in: fgLots.map((l) => l.id) } }, orderBy: { performedAt: 'asc' } });
    const sum = (types: string[]) => r3(txns.filter((t) => types.includes(t.type)).reduce((a, t) => a + Number(t.quantity), 0));
    const produced = sum(['FG_RECEIPT']);
    const dispatched = -sum(['DISPATCH']);
    const returned = sum(['RETURN_FROM_PRODUCTION']);
    const adjusted = sum(['ADJUSTMENT', 'QC_SAMPLING']);
    const onHand = r3(fgLots.reduce((a, l) => a + Number(l.quantity), 0));
    const warehouses = await this.prisma.db.warehouse.findMany({ where: { id: { in: fgLots.map((l) => l.warehouseId) } }, select: { id: true, code: true, name: true } });
    const names = await this.users.names(txns.map((t) => t.performedById));
    const accounted = r3(onHand + dispatched - returned - adjusted);
    return {
      batch: { id: b.id, batchNumber: b.batchNumber, status: b.status, product: `${b.product.code} ${b.product.genericName} ${b.product.strength}`, expiryDate: b.expiryDate, uom: b.uomCode },
      reconciliation: {
        produced,
        onHand,
        dispatched,
        returned,
        adjustmentsAndSamples: adjusted,
        accountedFor: accounted,
        unaccounted: r3(produced - accounted),
        reconciled: Math.abs(produced - accounted) < 0.001,
      },
      locations: fgLots.map((l) => ({ lotId: l.id, lotNumber: l.lotNumber, status: l.status, warehouse: warehouses.find((w) => w.id === l.warehouseId)?.code ?? '—', onHand: Number(l.quantity) })),
      movements: txns.map((t) => ({ id: t.id, at: t.performedAt, type: t.type, quantity: Number(t.quantity), balanceAfter: Number(t.balanceAfter), reason: t.reason, by: t.performedById ? (names[t.performedById] ?? null) : null })),
      customers: { captured: false, note: 'Customer/distributor-level dispatch detail is held in the ERP/distribution system and is not captured in this release. Use the dispatch movements above with the ERP shipment register.' },
    };
  }
}

@ApiTags('traceability')
@ApiBearerAuth()
@Controller('traceability')
export class TraceabilityController {
  constructor(
    private readonly svc: TraceabilityService,
    private readonly audit: AuditService,
  ) {}

  @Get('search')
  @RequirePermissions('batch.view', 'inventory.view')
  search(@Query('q') q = '') {
    return this.svc.search(q);
  }

  @Get('lots/:id')
  @RequirePermissions('batch.view', 'inventory.view')
  lot(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.forwardFromLot(id);
  }

  @Get('batches/:id')
  @RequirePermissions('batch.view', 'inventory.view')
  batch(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.backwardFromBatch(id);
  }

  @Get('batches/:id/recall')
  @RequirePermissions('batch.view', 'inventory.view')
  recall(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.recall(id);
  }

  @Get('batches/:id/recall/export')
  @RequirePermissions('batch.view', 'inventory.view', 'report.export')
  async export(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const [r, g] = await Promise.all([this.svc.recall(id), this.svc.backwardFromBatch(id)]);
    await this.audit.recordStandalone({ entityType: 'Batch', entityId: id, entityLabel: r.batch.batchNumber, action: 'EXPORT', reason: 'Recall reconciliation report exported' });
    const rows: Record<string, unknown>[] = [
      { section: 'Batch', item: r.batch.batchNumber, detail: r.batch.product, quantity: '', note: `Status ${r.batch.status}` },
      ...Object.entries(r.reconciliation).map(([k, v]) => ({ section: 'Reconciliation', item: k, detail: '', quantity: v, note: '' })),
      ...r.locations.map((l) => ({ section: 'Location', item: l.lotNumber, detail: l.warehouse, quantity: l.onHand, note: l.status })),
      ...r.movements.map((m) => ({ section: 'Movement', item: m.type, detail: m.reason ?? '', quantity: m.quantity, note: new Date(m.at).toISOString() })),
      ...g.inputs.map((i) => ({ section: 'Input lot', item: i.lotNumber, detail: `${i.material} / ${i.supplier} / supplier batch ${i.supplierBatch ?? '—'}`, quantity: i.quantityUsed, note: i.grn?.number ?? '' })),
      { section: 'Customers', item: '', detail: r.customers.note, quantity: '', note: '' },
    ];
    return sendCsv(
      res,
      `recall-reconciliation-${r.batch.batchNumber}.csv`,
      toCsv(rows, ['section', 'item', 'detail', 'quantity', 'note'].map((k) => ({ header: k[0].toUpperCase() + k.slice(1), value: (row: Record<string, unknown>) => row[k] }))),
    );
  }
}
