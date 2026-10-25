import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthPrincipal } from '../../common/auth-user';
import { NotFoundError, RuleViolationError, ValidationError } from '../../common/errors';
import { FilterQueryDto, orderBy, pageArgs, statusFilter, toPage } from '../../common/pagination';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NumberingService, SettingsService, UserDirectory } from '../core/core.services';
import { NotificationService } from '../notifications/notification.service';
import { SampleRequestService } from '../sampling/sample-request.service';
import { CreateGrnDto } from './inventory.dto';
import { InventoryLedger } from './ledger.service';

@Injectable()
export class GrnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedger,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly settings: SettingsService,
    private readonly sampling: SampleRequestService,
    private readonly notifications: NotificationService,
    private readonly users: UserDirectory,
  ) {}

  async list(q: FilterQueryDto) {
    const where: Prisma.GoodsReceiptWhereInput = {
      status: statusFilter(q),
      supplierId: q.supplierId || undefined,
      siteId: q.siteId || undefined,
      ...(q.q ? { OR: [{ number: { contains: q.q, mode: 'insensitive' } }, { lines: { some: { supplierBatch: { contains: q.q, mode: 'insensitive' } } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.goodsReceipt.findMany({ where, include: { lines: true }, orderBy: orderBy(q, ['number', 'receivedAt'], { receivedAt: 'desc' }), ...pageArgs(q) }),
      this.prisma.db.goodsReceipt.count({ where }),
    ]);
    const suppliers = await this.prisma.db.supplier.findMany({ where: { id: { in: rows.map((r) => r.supplierId) } }, select: { id: true, code: true, name: true } });
    const sm = new Map(suppliers.map((s) => [s.id, s]));
    return toPage(await this.users.decorate(rows.map((r) => ({ ...r, supplier: sm.get(r.supplierId) })), ['receivedById']), total, q);
  }

  async get(id: string) {
    const grn = await this.prisma.db.goodsReceipt.findFirst({ where: { id }, include: { lines: true } });
    if (!grn) throw new NotFoundError('Goods receipt', id);
    const [supplier, lots, materials, samples, po] = await Promise.all([
      this.prisma.db.supplier.findFirst({ where: { id: grn.supplierId }, select: { id: true, code: true, name: true } }),
      this.prisma.db.inventoryLot.findMany({ where: { id: { in: grn.lines.map((l) => l.lotId) } } }),
      this.prisma.db.material.findMany({ where: { id: { in: grn.lines.map((l) => l.materialId) } }, select: { id: true, code: true, name: true, type: true } }),
      this.prisma.db.qcSample.findMany({ where: { lotId: { in: grn.lines.map((l) => l.lotId) } }, select: { id: true, number: true, status: true, conclusion: true, lotId: true } }),
      grn.purchaseOrderId ? this.prisma.db.purchaseOrder.findFirst({ where: { id: grn.purchaseOrderId }, select: { id: true, number: true } }) : null,
    ]);
    const lm = new Map(lots.map((l) => [l.id, l]));
    const mm = new Map(materials.map((m) => [m.id, m]));
    return this.users.decorateOne(
      {
        ...grn,
        supplier,
        purchaseOrder: po,
        lines: grn.lines.map((l) => ({ ...l, lot: lm.get(l.lotId), material: mm.get(l.materialId), samples: samples.filter((s) => s.lotId === l.lotId) })),
      },
      ['receivedById'],
    );
  }

  /**
   * Receives material. Every line creates a lot in QUARANTINE (never directly usable),
   * posts a GRN_RECEIPT ledger entry and requests a QC sample — all in one transaction.
   */
  async create(user: AuthPrincipal, dto: CreateGrnDto) {
    user.require('inventory.receive', dto.siteId);
    for (const [i, l] of dto.lines.entries()) {
      const mfg = new Date(l.mfgDate);
      const exp = new Date(l.expiryDate);
      if (exp <= mfg) throw new ValidationError(`Line ${i + 1}: expiry date must be after manufacturing date`);
      if (mfg > new Date()) throw new ValidationError(`Line ${i + 1}: manufacturing date cannot be in the future`);
      if (exp <= new Date()) throw new RuleViolationError(`Line ${i + 1}: material is already expired and cannot be received`);
      if (l.retestDate && new Date(l.retestDate) > exp) throw new ValidationError(`Line ${i + 1}: retest date cannot be after expiry`);
    }
    return this.prisma.transaction(async (tx) => {
      const settings = await this.settings.get(user.tenantId, tx);
      const supplier = await tx.supplier.findFirst({ where: { id: dto.supplierId }, include: { materials: { where: { approved: true } } } });
      if (!supplier) throw new NotFoundError('Supplier', dto.supplierId);
      if (supplier.status !== 'APPROVED' && supplier.status !== 'CONDITIONALLY_APPROVED') {
        throw new RuleViolationError(`Supplier ${supplier.code} is ${supplier.status}; material cannot be received from unqualified suppliers`, [
          { code: 'SUPPLIER_NOT_QUALIFIED', message: `Supplier status ${supplier.status}`, href: `/master-data/suppliers/${supplier.id}` },
        ]);
      }
      const approved = new Set(supplier.materials.map((m) => m.materialId));
      const po = dto.purchaseOrderId ? await tx.purchaseOrder.findFirst({ where: { id: dto.purchaseOrderId }, include: { lines: true } }) : null;
      if (dto.purchaseOrderId && !po) throw new NotFoundError('Purchase order', dto.purchaseOrderId);
      if (po && po.supplierId !== supplier.id) throw new ValidationError('Purchase order belongs to a different supplier');
      if (po && !['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)) throw new RuleViolationError(`Purchase order ${po.number} is ${po.status}`);

      const number = await this.numbering.next(tx, user.tenantId, 'GRN');
      const grn = await tx.goodsReceipt.create({
        data: { tenantId: user.tenantId, siteId: dto.siteId, number, supplierId: supplier.id, purchaseOrderId: po?.id, receivedById: user.id, deliveryNote: dto.deliveryNote, remarks: dto.remarks },
      });

      const created: { lotNumber: string; material: string }[] = [];
      for (const l of dto.lines) {
        const material = await tx.material.findFirst({ where: { id: l.materialId } });
        if (!material) throw new NotFoundError('Material', l.materialId);
        if (material.status !== 'ACTIVE') throw new RuleViolationError(`Material ${material.code} is not active`);
        if (!approved.has(material.id)) {
          throw new RuleViolationError(`Material ${material.code} is not approved for supplier ${supplier.code}`, [{ code: 'MATERIAL_NOT_APPROVED_FOR_SUPPLIER', message: material.code }]);
        }
        const wh = await tx.warehouse.findFirst({ where: { id: l.warehouseId, siteId: dto.siteId } });
        if (!wh) throw new ValidationError(`Warehouse not found at this site`);
        if (l.binId && !(await tx.binLocation.findFirst({ where: { id: l.binId, warehouseId: wh.id } }))) throw new ValidationError('Bin does not belong to warehouse');
        if (po) {
          const pl = po.lines.find((x) => x.id === l.poLineId) ?? po.lines.find((x) => x.materialId === l.materialId);
          if (!pl || pl.materialId !== l.materialId) throw new ValidationError(`Material ${material.code} is not on purchase order ${po.number}`);
          await tx.purchaseOrderLine.update({ where: { id: pl.id }, data: { receivedQuantity: { increment: l.quantity } } });
          l.poLineId = pl.id;
        }
        const uom = await tx.unitOfMeasure.findFirst({ where: { id: material.uomId } });
        const lotNumber = await this.numbering.next(tx, user.tenantId, 'LOT', { prefix: material.lotPrefix });
        const retest = l.retestDate
          ? new Date(l.retestDate)
          : material.retestPeriodMonths
            ? new Date(new Date(l.mfgDate).setMonth(new Date(l.mfgDate).getMonth() + material.retestPeriodMonths))
            : null;
        const lot = await tx.inventoryLot.create({
          data: {
            tenantId: user.tenantId,
            siteId: dto.siteId,
            itemType: 'MATERIAL',
            materialId: material.id,
            lotNumber,
            supplierBatch: l.supplierBatch,
            supplierId: supplier.id,
            mfgDate: new Date(l.mfgDate),
            expiryDate: new Date(l.expiryDate),
            retestDate: retest && retest < new Date(l.expiryDate) ? retest : null,
            quantity: l.quantity,
            uomCode: uom?.code ?? 'EA',
            warehouseId: wh.id,
            binId: l.binId,
            status: settings.receiptDefaultStatus,
            sourceType: 'GRN',
            sourceId: grn.id,
            unitCost: material.unitCost,
          },
        });
        await this.ledger.receipt(tx, lot, 'GRN_RECEIPT', { referenceType: 'GoodsReceipt', referenceId: grn.id, performedById: user.id });
        await tx.goodsReceiptLine.create({
          data: {
            tenantId: user.tenantId,
            goodsReceiptId: grn.id,
            poLineId: l.poLineId,
            materialId: material.id,
            supplierBatch: l.supplierBatch,
            lotId: lot.id,
            quantity: l.quantity,
            containers: l.containers ?? 1,
            mfgDate: new Date(l.mfgDate),
            expiryDate: new Date(l.expiryDate),
            retestDate: lot.retestDate,
          },
        });
        await this.audit.record(tx, {
          entityType: 'InventoryLot',
          entityId: lot.id,
          entityLabel: lot.lotNumber,
          action: 'CREATE',
          next: { material: material.code, quantity: l.quantity, status: lot.status, supplierBatch: l.supplierBatch, grn: number },
        });
        await this.sampling.request(tx, {
          tenantId: user.tenantId,
          siteId: dto.siteId,
          stage: material.type === 'PACKAGING' ? 'PACKAGING_MATERIAL' : 'RAW_MATERIAL',
          materialId: material.id,
          lotId: lot.id,
          requestedById: user.id,
          label: `${material.name} lot ${lotNumber}`,
        });
        created.push({ lotNumber, material: material.code });
      }

      if (po) {
        const lines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId: po.id } });
        const complete = lines.every((x) => Number(x.receivedQuantity) >= Number(x.quantity));
        await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: complete ? 'RECEIVED' : 'PARTIALLY_RECEIVED' } });
      }
      await this.audit.record(tx, { entityType: 'GoodsReceipt', entityId: grn.id, entityLabel: number, action: 'CREATE', next: { supplier: supplier.code, lots: created, purchaseOrder: po?.number ?? null } });
      await this.notifications.notify(tx, {
        tenantId: user.tenantId,
        event: 'LOT_AWAITING_DISPOSITION',
        title: `${number}: ${created.length} lot(s) in quarantine`,
        body: `Received from ${supplier.name}: ${created.map((c) => `${c.material} ${c.lotNumber}`).join(', ')}. Pending QC and QA disposition.`,
        entityType: 'GoodsReceipt',
        entityId: grn.id,
        link: `/inventory/receipts/${grn.id}`,
        permission: 'inventory.release',
        siteId: dto.siteId,
      });
      return { ...grn, lots: created };
    });
  }
}
